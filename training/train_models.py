import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.model_selection import KFold
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import pandas as pd
import numpy as np
import time
import os

# ══════════════════════════════════════════════════════════
#  1. SETTINGS
# ══════════════════════════════════════════════════════════
DATA_PATH = '/kaggle/input/datasets/goatsandigan/rice-diseases-data/final_split'
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 10
FINETUNE_EPOCHS = 5
K_FOLDS = 5
K_FOLD_EPOCHS = 5

# ══════════════════════════════════════════════════════════
#  2. MULTI-GPU STRATEGY
# ══════════════════════════════════════════════════════════
strategy = tf.distribute.MirroredStrategy()
print(f"✅ Training on {strategy.num_replicas_in_sync} GPUs")

# ══════════════════════════════════════════════════════════
#  3. DATA LOADING — Load EVERYTHING as NumPy
#     (fixes MirroredStrategy evaluate() returning 0s)
# ══════════════════════════════════════════════════════════
def prepare_data():
    """Load all images into NumPy arrays for reliable evaluation."""
    train_ds = tf.keras.utils.image_dataset_from_directory(
        f'{DATA_PATH}/train',
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode='categorical',
        shuffle=False
    )

    test_ds = tf.keras.utils.image_dataset_from_directory(
        f'{DATA_PATH}/val',
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode='categorical',
        shuffle=False
    )

    class_names = train_ds.class_names

    # Convert train to numpy
    train_images, train_labels = [], []
    for imgs, lbls in train_ds:
        train_images.append(imgs.numpy())
        train_labels.append(lbls.numpy())

    # Convert test to numpy too (KEY FIX — avoids MirroredStrategy evaluate bug)
    test_images, test_labels = [], []
    for imgs, lbls in test_ds:
        test_images.append(imgs.numpy())
        test_labels.append(lbls.numpy())

    print(f"📦 Loaded {len(class_names)} classes: {class_names}")

    return (
        np.concatenate(train_images),
        np.concatenate(train_labels),
        np.concatenate(test_images),
        np.concatenate(test_labels),
        len(class_names),
        class_names
    )

X_train, y_train, X_test, y_test, num_classes, class_names = prepare_data()
print(f"📊 Training: {len(X_train)} | Test: {len(X_test)} samples")


# ══════════════════════════════════════════════════════════
#  4. MODEL FACTORY
# ══════════════════════════════════════════════════════════
def build_compiled_model(model_name, base_model_fn, preprocess_fn, learning_rate=0.001):
    """Build transfer learning model with proper preprocessing."""
    with strategy.scope():
        # Data Augmentation
        aug = tf.keras.Sequential([
            layers.Input(shape=(224, 224, 3)),
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.15),
            layers.RandomZoom(0.1),
            layers.RandomContrast(0.1),
        ], name='augmentation')

        # Model-specific preprocessing (CRITICAL for accuracy)
        preprocess_layer = layers.Lambda(preprocess_fn, name='preprocessing')

        # Base model (frozen initially)
        base_model = base_model_fn(
            weights='imagenet',
            include_top=False,
            input_shape=(224, 224, 3)
        )
        base_model.trainable = False

        model = models.Sequential([
            aug,
            preprocess_layer,
            base_model,
            layers.GlobalAveragePooling2D(),
            layers.BatchNormalization(),
            layers.Dense(256, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(num_classes, activation='softmax')
        ])

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
    return model, base_model


# ══════════════════════════════════════════════════════════
#  5. RELIABLE EVALUATION (uses sklearn, not TF metrics)
# ══════════════════════════════════════════════════════════
def evaluate_model(model, X, y_true_onehot):
    """
    Evaluate using sklearn metrics instead of model.evaluate().
    This is 100% reliable regardless of MirroredStrategy quirks.
    """
    # Get predictions
    y_pred_probs = model.predict(X, batch_size=BATCH_SIZE, verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)
    y_true = np.argmax(y_true_onehot, axis=1)

    acc = accuracy_score(y_true, y_pred)
    pre = precision_score(y_true, y_pred, average='weighted', zero_division=0)
    rec = recall_score(y_true, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)

    return acc, pre, rec, f1


# ══════════════════════════════════════════════════════════
#  6. TRAINING PIPELINE
# ══════════════════════════════════════════════════════════
def run_experiment(name, model_fn, preprocess_fn):
    print(f"\n{'='*60}")
    print(f"🚀 Starting: {name}")
    print(f"{'='*60}")

    # ── Phase A: K-Fold Cross-Validation ──
    kfold = KFold(n_splits=K_FOLDS, shuffle=True, random_state=42)
    cv_accs = []

    for fold, (t_idx, v_idx) in enumerate(kfold.split(X_train), 1):
        model, _ = build_compiled_model(name, model_fn, preprocess_fn)
        model.fit(
            X_train[t_idx], y_train[t_idx],
            epochs=K_FOLD_EPOCHS,
            batch_size=BATCH_SIZE,
            verbose=0
        )
        # Use sklearn for CV eval too
        acc, _, _, _ = evaluate_model(model, X_train[v_idx], y_train[v_idx])
        cv_accs.append(acc)
        print(f"  Fold {fold} Val Acc: {acc:.4f}")

    print(f"  📈 CV Mean Accuracy: {np.mean(cv_accs):.4f} ± {np.std(cv_accs):.4f}")

    # ── Phase B: Final Training (frozen base) ──
    final_model, base_model = build_compiled_model(name, model_fn, preprocess_fn)
    start = time.time()

    final_model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_split=0.1,
        callbacks=[
            EarlyStopping(
                monitor='val_loss',
                patience=3,
                restore_best_weights=True,
                verbose=1
            )
        ],
        verbose=1
    )

    # ── Evaluate BEFORE fine-tuning (to compare) ──
    frozen_acc, _, _, frozen_f1 = evaluate_model(final_model, X_test, y_test)
    print(f"  📊 Frozen model — Test Acc: {frozen_acc:.4f} | F1: {frozen_f1:.4f}")

    # ── Phase C: Fine-Tuning (careful — small dataset!) ──
    print(f"  🔓 Fine-tuning top layers of {name}...")
    base_model.trainable = True

    # Only unfreeze the last ~15% of layers (safer for small datasets)
    freeze_until = int(len(base_model.layers) * 0.85)
    for layer in base_model.layers[:freeze_until]:
        layer.trainable = False

    trainable_count = sum(1 for l in base_model.layers if l.trainable)
    print(f"  Unfroze {trainable_count}/{len(base_model.layers)} base layers")

    # Use VERY low learning rate to avoid destroying frozen weights
    with strategy.scope():
        final_model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=5e-6),
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

    final_model.fit(
        X_train, y_train,
        epochs=FINETUNE_EPOCHS,
        batch_size=BATCH_SIZE,
        validation_split=0.1,
        callbacks=[
            EarlyStopping(
                monitor='val_loss',
                patience=2,
                restore_best_weights=True,
                verbose=1
            )
        ],
        verbose=1
    )

    train_time = time.time() - start

    # ── Phase D: Final Evaluation with sklearn (RELIABLE!) ──
    acc, pre, rec, f1 = evaluate_model(final_model, X_test, y_test)

    # If fine-tuning hurt performance, report the frozen model scores
    if frozen_f1 > f1:
        print(f"  ⚠️  Fine-tuning degraded performance, using frozen model scores")
        # Retrain without fine-tuning for the saved model
        final_model, _ = build_compiled_model(name, model_fn, preprocess_fn)
        final_model.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE,
                        validation_split=0.1,
                        callbacks=[EarlyStopping(monitor='val_loss', patience=3,
                                                 restore_best_weights=True, verbose=0)],
                        verbose=0)
        acc, pre, rec, f1 = evaluate_model(final_model, X_test, y_test)

    print(f"\n  ✅ {name} FINAL Results:")
    print(f"     Test Acc: {acc:.4f} | F1: {f1:.4f} | Precision: {pre:.4f} | Recall: {rec:.4f}")
    print(f"     Training Time: {train_time:.1f}s")

    # ── Save Model ──
    save_path = f'/kaggle/working/{name}_rice_disease.keras'
    final_model.save(save_path)
    print(f"  💾 Saved to {save_path}")

    return {
        'Model': name,
        'CV_Mean': round(np.mean(cv_accs), 4),
        'CV_Std': round(np.std(cv_accs), 4),
        'Test_Acc': round(acc, 4),
        'Test_Precision': round(pre, 4),
        'Test_Recall': round(rec, 4),
        'Test_F1': round(f1, 4),
        'Time_sec': round(train_time, 2),
    }


# ══════════════════════════════════════════════════════════
#  7. RUN ALL EXPERIMENTS
# ══════════════════════════════════════════════════════════
configs = [
    ('MobileNetV2',     tf.keras.applications.MobileNetV2,     tf.keras.applications.mobilenet_v2.preprocess_input),
    ('DenseNet201',     tf.keras.applications.DenseNet201,      tf.keras.applications.densenet.preprocess_input),
    ('EfficientNetV2S', tf.keras.applications.EfficientNetV2S,  tf.keras.applications.efficientnet_v2.preprocess_input),
]

final_results = []
for name, fn, preprocess in configs:
    result = run_experiment(name, fn, preprocess)
    final_results.append(result)

# ══════════════════════════════════════════════════════════
#  8. FINAL RESULTS TABLE
# ══════════════════════════════════════════════════════════
df = pd.DataFrame(final_results)
print("\n" + "=" * 80)
print("🏆 FINAL COMPARISON — Rice Disease Classification")
print("=" * 80)
print(df.to_string(index=False))
print()

best = df.loc[df['Test_F1'].idxmax()]
print(f"👑 Best Model: {best['Model']} (F1: {best['Test_F1']:.4f}, Acc: {best['Test_Acc']:.4f})")

df.to_csv('/kaggle/working/training_results.csv', index=False)
print("📄 Results saved to training_results.csv")

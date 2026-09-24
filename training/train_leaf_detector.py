"""
RiceGuard — YOLOv8 Rice Leaf Detector Training Script
=====================================================
Trains a binary classification model: rice_leaf vs not_rice_leaf

This is Step 1 of the 3-Step YOLO pipeline.
It determines whether an uploaded image is a rice leaf before
passing it to the disease classifier.

HOW TO USE (on Kaggle):
  1. Create a New Notebook on Kaggle
  2. Enable GPU: Settings → Accelerator → GPU T4 x2
  3. Add your dataset: goatsandigan/rice-diseases-data
  4. Copy-paste this entire script into a cell and run it
  5. Download rice_leaf_detector.pt from the Output tab
  6. Drop it in: flask_api/trained_models/rice_leaf_detector.pt
"""

import os
import shutil
import random
from pathlib import Path

# ══════════════════════════════════════════════════════════
#  CONFIGURATION
# ══════════════════════════════════════════════════════════

# Your existing rice disease dataset on Kaggle
RICE_DATASET = '/kaggle/input/datasets/goatsandigan/rice-diseases-data/final_split'

# Where to build the leaf detector dataset
OUTPUT_DIR = '/kaggle/working/leaf_detector_dataset'
TRAIN_DIR = os.path.join(OUTPUT_DIR, 'train')
VAL_DIR = os.path.join(OUTPUT_DIR, 'val')

# Training settings
EPOCHS = 20
IMG_SIZE = 224
BATCH_SIZE = 32

# ══════════════════════════════════════════════════════════
#  STEP 1: BUILD DATASET
#  - rice_leaf class: All images from your disease dataset
#  - not_rice_leaf class: Random non-leaf images
# ══════════════════════════════════════════════════════════

def build_dataset():
    """Build a binary classification dataset from existing rice disease images."""
    print("📦 Building leaf detector dataset...")

    # Clean previous builds
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)

    # Create directories
    for split in [TRAIN_DIR, VAL_DIR]:
        os.makedirs(os.path.join(split, 'rice_leaf'), exist_ok=True)
        os.makedirs(os.path.join(split, 'not_rice_leaf'), exist_ok=True)

    # ── Collect all rice leaf images from existing dataset ──
    rice_images = []
    for split_name in ['train', 'val']:
        split_path = os.path.join(RICE_DATASET, split_name)
        if not os.path.exists(split_path):
            print(f"⚠️ Path not found: {split_path}")
            continue
        for class_dir in os.listdir(split_path):
            class_path = os.path.join(split_path, class_dir)
            if os.path.isdir(class_path):
                for img_file in os.listdir(class_path):
                    if img_file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                        rice_images.append(os.path.join(class_path, img_file))

    print(f"   Found {len(rice_images)} rice leaf images")

    # Shuffle and split 80/20
    random.seed(42)
    random.shuffle(rice_images)
    split_idx = int(len(rice_images) * 0.8)
    train_rice = rice_images[:split_idx]
    val_rice = rice_images[split_idx:]

    # Copy rice leaf images
    for i, src in enumerate(train_rice):
        ext = os.path.splitext(src)[1]
        shutil.copy(src, os.path.join(TRAIN_DIR, 'rice_leaf', f'rice_{i:04d}{ext}'))
    for i, src in enumerate(val_rice):
        ext = os.path.splitext(src)[1]
        shutil.copy(src, os.path.join(VAL_DIR, 'rice_leaf', f'rice_{i:04d}{ext}'))

    print(f"   ✅ Rice leaf: {len(train_rice)} train / {len(val_rice)} val")

    # ── Generate NOT rice leaf images (synthetic noise/random patterns) ──
    # We'll create non-leaf images using random colors, gradients, and patterns
    # This way we don't need to download anything external
    generate_not_rice_leaf_images(
        os.path.join(TRAIN_DIR, 'not_rice_leaf'),
        count=min(len(train_rice), 2000)
    )
    generate_not_rice_leaf_images(
        os.path.join(VAL_DIR, 'not_rice_leaf'),
        count=min(len(val_rice), 500)
    )

    # Count final totals
    train_leaf = len(os.listdir(os.path.join(TRAIN_DIR, 'rice_leaf')))
    train_not = len(os.listdir(os.path.join(TRAIN_DIR, 'not_rice_leaf')))
    val_leaf = len(os.listdir(os.path.join(VAL_DIR, 'rice_leaf')))
    val_not = len(os.listdir(os.path.join(VAL_DIR, 'not_rice_leaf')))

    print(f"\n📊 Final Dataset:")
    print(f"   Train: {train_leaf} rice_leaf + {train_not} not_rice_leaf")
    print(f"   Val:   {val_leaf} rice_leaf + {val_not} not_rice_leaf")


def generate_not_rice_leaf_images(output_dir: str, count: int):
    """Generate synthetic non-leaf images for negative samples."""
    from PIL import Image
    import numpy as np

    print(f"   🎨 Generating {count} non-leaf images...")

    for i in range(count):
        img_type = random.choice(['solid', 'gradient', 'noise', 'pattern', 'sky', 'urban', 'texture'])

        if img_type == 'solid':
            # Solid color (non-green: blues, reds, purples, grays)
            r = random.randint(0, 255)
            g = random.randint(0, min(r + 20, 255))  # Keep green low relative to red
            b = random.randint(0, 255)
            arr = np.full((224, 224, 3), [r, g, b], dtype=np.uint8)

        elif img_type == 'gradient':
            # Color gradient (sky-like, indoor-like)
            c1 = np.array([random.randint(50, 255), random.randint(50, 200), random.randint(100, 255)])
            c2 = np.array([random.randint(50, 255), random.randint(50, 200), random.randint(100, 255)])
            arr = np.zeros((224, 224, 3), dtype=np.uint8)
            for row in range(224):
                t = row / 223
                arr[row, :] = (c1 * (1 - t) + c2 * t).astype(np.uint8)

        elif img_type == 'noise':
            # Random noise (camera artifacts, indoor clutter)
            arr = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)

        elif img_type == 'pattern':
            # Geometric pattern (man-made objects)
            arr = np.zeros((224, 224, 3), dtype=np.uint8)
            color = [random.randint(100, 255), random.randint(50, 150), random.randint(100, 255)]
            stripe_width = random.randint(10, 40)
            for row in range(224):
                if (row // stripe_width) % 2 == 0:
                    arr[row, :] = color

        elif img_type == 'sky':
            # Blue sky / clouds
            arr = np.zeros((224, 224, 3), dtype=np.uint8)
            for row in range(224):
                blue = min(255, 150 + int(row * 0.4))
                arr[row, :] = [100 + random.randint(-20, 20),
                               140 + random.randint(-20, 20),
                               blue]

        elif img_type == 'urban':
            # Gray/brown concrete/asphalt tones
            base = random.randint(80, 180)
            arr = np.random.randint(
                max(0, base - 30), min(255, base + 30),
                (224, 224, 3), dtype=np.uint8
            )
            # Make it grayish (equal RGB)
            avg = arr.mean(axis=2, keepdims=True).astype(np.uint8)
            arr = np.broadcast_to(avg, arr.shape).copy()

        else:  # texture
            # Random texture with blocks
            block = random.randint(8, 32)
            small = np.random.randint(0, 256, (224 // block + 1, 224 // block + 1, 3), dtype=np.uint8)
            arr = np.kron(small, np.ones((block, block, 1))).astype(np.uint8)[:224, :224, :]

        img = Image.fromarray(arr)
        img.save(os.path.join(output_dir, f'not_leaf_{i:04d}.jpg'))


# ══════════════════════════════════════════════════════════
#  STEP 2: TRAIN YOLOV8 CLASSIFIER
# ══════════════════════════════════════════════════════════

def train_detector():
    """Train YOLOv8 classification model for leaf detection."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ Installing ultralytics...")
        os.system('pip install ultralytics')
        from ultralytics import YOLO

    print(f"\n🚀 Training YOLOv8 Leaf Detector (rice_leaf vs not_rice_leaf)...")
    print(f"   Epochs: {EPOCHS} | Image Size: {IMG_SIZE} | Batch: {BATCH_SIZE}")

    model = YOLO('yolov8n-cls.pt')  # Nano classification model (fast, light)

    results = model.train(
        data=OUTPUT_DIR,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        project='/kaggle/working',
        name='leaf_detector_training',
        patience=5,
        save=True,
        verbose=True,
    )

    # Copy best weights to output
    best_path = os.path.join(results.save_dir, 'weights', 'best.pt')
    target_path = '/kaggle/working/rice_leaf_detector.pt'

    if os.path.exists(best_path):
        shutil.copy(best_path, target_path)
        print(f"\n✅ SUCCESS! Model saved to: {target_path}")
        print(f"📥 Download 'rice_leaf_detector.pt' from the Output tab")
        print(f"📁 Then place it in: flask_api/trained_models/rice_leaf_detector.pt")
    else:
        print(f"⚠️ Training completed but best.pt not found at {best_path}")

    # Quick validation test
    print("\n🧪 Quick Validation Test:")
    val_model = YOLO(target_path)
    test_dir = os.path.join(VAL_DIR, 'rice_leaf')
    test_images = os.listdir(test_dir)[:5]
    for img_name in test_images:
        result = val_model(os.path.join(test_dir, img_name))[0]
        pred = result.names[int(result.probs.top1)]
        conf = float(result.probs.top1conf) * 100
        print(f"   {img_name}: {pred} ({conf:.1f}%)")


# ══════════════════════════════════════════════════════════
#  RUN
# ══════════════════════════════════════════════════════════
if __name__ == '__main__':
    build_dataset()
    train_detector()
    print("\n🎉 All done! Download rice_leaf_detector.pt and place it in flask_api/trained_models/")

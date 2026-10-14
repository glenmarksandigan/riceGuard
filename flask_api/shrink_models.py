"""
shrink_models.py
Converts one or all CNN Keras models to float16-quantized TFLite format so
they fit under GitHub's 100 MB file-size limit.

Usage:
    # Shrink all models
    python shrink_models.py

    # Shrink a specific model
    python shrink_models.py DenseNet201_rice_disease.keras DenseNet201_rice_disease_quantized.tflite
"""

import os
import sys

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import tensorflow as tf
import models  # Registers custom preprocessing functions before loading saved models.

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'trained_models')

# Maps Keras model filename -> output TFLite filename
MODEL_MAP = {
    'MobileNetV2_rice_disease.keras':    'MobileNetV2_rice_disease_quantized.tflite',
    'DenseNet201_rice_disease.keras':    'DenseNet201_rice_disease_quantized.tflite',
    'EfficientNetV2S_rice_disease.keras':'EfficientNetV2S_rice_disease_quantized.tflite',
}


def shrink_model(model_name: str, output_name: str) -> str:
    """Load a Keras model, apply float16 quantization, and save as TFLite."""
    keras_path = os.path.join(MODELS_DIR, model_name)
    if not os.path.exists(keras_path):
        raise FileNotFoundError(f'Model file not found: {keras_path}')

    print(f'\n🔄 Loading {model_name}  ({os.path.getsize(keras_path) / 1_048_576:.1f} MB)...')
    model = tf.keras.models.load_model(keras_path, compile=False)

    print('⚙️  Converting to float16-quantized TFLite...')
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_model = converter.convert()

    output_path = os.path.join(MODELS_DIR, output_name)
    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    original_mb  = os.path.getsize(keras_path)  / 1_048_576
    quantized_mb = os.path.getsize(output_path) / 1_048_576
    reduction    = (1 - quantized_mb / original_mb) * 100

    print(f'✅ Saved: {output_path}')
    print(f'   Original : {original_mb:.1f} MB')
    print(f'   Quantized: {quantized_mb:.1f} MB  ({reduction:.0f}% reduction)')
    return output_path


def shrink_all() -> None:
    """Shrink every model listed in MODEL_MAP."""
    print(f'🚀 Shrinking {len(MODEL_MAP)} models...')
    skipped = []
    for keras_name, tflite_name in MODEL_MAP.items():
        keras_path = os.path.join(MODELS_DIR, keras_name)
        if not os.path.exists(keras_path):
            print(f'⚠️  Skipping {keras_name} (not found)')
            skipped.append(keras_name)
            continue
        shrink_model(keras_name, tflite_name)

    print('\n🎉 Done!')
    if skipped:
        print(f'   Skipped (missing): {", ".join(skipped)}')


if __name__ == '__main__':
    if len(sys.argv) == 3:
        # Single model: python shrink_models.py <input.keras> <output.tflite>
        shrink_model(sys.argv[1], sys.argv[2])
    elif len(sys.argv) == 1:
        # Shrink everything
        shrink_all()
    else:
        print('Usage:')
        print('  python shrink_models.py                                  # shrink all')
        print('  python shrink_models.py <input.keras> <output.tflite>   # shrink one')
        sys.exit(1)

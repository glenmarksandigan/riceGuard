import os
import sys

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import tensorflow as tf
import models  # Registers custom preprocessing functions before loading the saved model.

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'trained_models')
MODEL_NAME = 'MobileNetV2_rice_disease.keras'
OUTPUT_NAME = 'MobileNetV2_rice_disease_quantized.tflite'


def shrink_model(model_name: str = MODEL_NAME, output_name: str = OUTPUT_NAME):
    keras_path = os.path.join(MODELS_DIR, model_name)
    if not os.path.exists(keras_path):
        raise FileNotFoundError(f'Model file not found: {keras_path}')

    model = tf.keras.models.load_model(keras_path, compile=False)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_model = converter.convert()

    output_path = os.path.join(MODELS_DIR, output_name)
    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    print(f'✅ Saved quantized model: {output_path}')
    print(f'Original size: {os.path.getsize(keras_path):,} bytes')
    print(f'Quantized size: {os.path.getsize(output_path):,} bytes')
    return output_path


if __name__ == '__main__':
    if len(sys.argv) > 1:
        shrink_model(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else OUTPUT_NAME)
    else:
        shrink_model()

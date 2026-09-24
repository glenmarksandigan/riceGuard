"""
RiceGuard — YOLOv8 Multi-Stage Training Pipeline

This script trains two YOLO models:
  1. Stage 1: Leaf Detection Model (YOLOv8 Detection) -> Detects 'rice_leaf' bounding boxes.
  2. Stage 2 & 3: Disease Classification Model (YOLOv8 Classification) -> Classifies leaf status & disease.

Usage:
  python train_yolo.py --dataset_dir /path/to/rice_dataset --epochs 30
"""

import os
import argparse

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    print("❌ Ultralytics is required for training YOLO models. Run: pip install ultralytics")


def train_leaf_detector(dataset_yaml: str, epochs: int = 30, imgsz: int = 640):
    """
    Train Stage 1 YOLOv8 Object Detection Model (rice_leaf vs background).
    """
    if not ULTRALYTICS_AVAILABLE:
        return

    print("🚀 [Stage 1] Training Rice Leaf Detector (YOLOv8 Detection)...")
    model = YOLO('yolov8n.pt')  # Pre-trained COCO base weights

    results = model.train(
        data=dataset_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=16,
        project='../flask_api/trained_models',
        name='rice_leaf_detector_exp',
        save=True
    )
    
    # Save target best model
    best_path = os.path.join(results.save_dir, 'weights', 'best.pt')
    target_path = os.path.abspath('../flask_api/trained_models/rice_leaf_detector.pt')
    
    if os.path.exists(best_path):
        import shutil
        shutil.copy(best_path, target_path)
        print(f"✅ Saved Stage 1 Detector to {target_path}")


def train_disease_classifier(dataset_dir: str, epochs: int = 30, imgsz: int = 224):
    """
    Train Stage 2 & 3 YOLOv8 Classification Model.
    Dataset directory must contain 'train' and 'val' folders with class subfolders:
      - Healthy Rice Leaf
      - Bacterial Leaf Blight
      - Leaf Blast
      - Sheath Blight
    """
    if not ULTRALYTICS_AVAILABLE:
        return

    print("🚀 [Stage 2 & 3] Training Rice Disease Classifier (YOLOv8 Classification)...")
    model = YOLO('yolov8n-cls.pt')  # Pre-trained ImageNet classification base weights

    results = model.train(
        data=dataset_dir,
        epochs=epochs,
        imgsz=imgsz,
        batch=32,
        project='../flask_api/trained_models',
        name='rice_disease_classifier_exp',
        save=True
    )

    best_path = os.path.join(results.save_dir, 'weights', 'best.pt')
    target_path = os.path.abspath('../flask_api/trained_models/rice_disease_classifier.pt')

    if os.path.exists(best_path):
        import shutil
        shutil.copy(best_path, target_path)
        print(f"✅ Saved Stage 2/3 Disease Classifier to {target_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train YOLO Models for RiceGuard")
    parser.add_argument('--dataset_cls', type=str, default='/kaggle/input/datasets/goatsandigan/rice-diseases-data/final_split', help="Path to classification dataset folder")
    parser.add_argument('--dataset_yaml', type=str, default='data.yaml', help="Path to YOLO detection dataset data.yaml")
    parser.add_argument('--epochs', type=int, default=30, help="Number of training epochs")
    parser.add_argument('--mode', type=str, choices=['cls', 'det', 'all'], default='cls', help="Training mode")

    args = parser.parse_args()

    if args.mode in ['cls', 'all']:
        train_disease_classifier(args.dataset_cls, epochs=args.epochs)

    if args.mode in ['det', 'all']:
        train_leaf_detector(args.dataset_yaml, epochs=args.epochs)

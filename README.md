# 🌾 RiceGuard

**AI-powered rice disease detection system** — a full-stack platform combining a mobile app (React Native / Expo), an admin web dashboard (PHP / XAMPP), and a Flask AI API server to detect and report rice leaf diseases in the field.

---

## 📖 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Tech Stack](#-tech-stack)
4. [Project Structure](#-project-structure)
5. [Prerequisites](#-prerequisites)
6. [Training the Models](#-training-the-models)
   - [Dataset](#dataset)
   - [Train Keras Models (MobileNetV2, DenseNet201, EfficientNetV2S)](#train-keras-models-mobilenetv2-densenet201-efficientnetv2s)
   - [Train YOLOv8 Leaf Detector](#train-yolov8-leaf-detector)
   - [Train YOLOv8 Disease Classifier](#train-yolov8-disease-classifier)
   - [Placing Trained Models](#placing-trained-models)
7. [Deploying the Flask AI API](#-deploying-the-flask-ai-api)
   - [Local Development](#local-development)
   - [Production — Linux Server](#production--linux-server)
8. [Deploying the PHP Admin Dashboard](#-deploying-the-php-admin-dashboard)
9. [Deploying the Mobile App](#-deploying-the-mobile-app)
   - [Development with Expo Go](#development-with-expo-go)
   - [Preview Build (APK)](#preview-build-apk)
   - [Production Build (App Bundle)](#production-build-app-bundle)
10. [API Reference](#-api-reference)
11. [Database Setup](#-database-setup)
12. [Environment Configuration](#-environment-configuration)
13. [Detected Diseases](#-detected-diseases)

---

## 🌿 Project Overview

RiceGuard helps rice farmers and agricultural field officers detect rice diseases directly from field photos. The system runs a unified **2-step AI pipeline**:

1. **Step 1 — Rice Leaf Detection**: A YOLOv8 gatekeeper model checks whether the image actually contains a rice leaf.
2. **Step 2 — Disease Classification**: The chosen AI model classifies the leaf as healthy or identifies the specific disease.

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Mobile App (Expo)                            │
│           Field Officers / Farmers take photos                   │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP POST /predict
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│            Flask AI API Server  (port 5000)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Step 1: rice_leaf_detector.pt  (YOLOv8)                  │  │
│  │          → Is this a rice leaf?                           │  │
│  └────────────────────┬───────────────────────────────────────┘  │
│                       │ if yes                                   │
│  ┌────────────────────▼───────────────────────────────────────┐  │
│  │  Step 2: Classification Model (user's choice)              │  │
│  │    · MobileNetV2_rice_disease.keras                        │  │
│  │    · DenseNet201_rice_disease.keras                        │  │
│  │    · EfficientNetV2S_rice_disease.keras                    │  │
│  │    · rice_disease_classifier.pt (YOLOv8)                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                       │  saves to MySQL (rice_guard_db)          │
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│         PHP Admin Dashboard  (XAMPP / Apache)                    │
│   Reports · Verifications · Field Visits · Users · Maps          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo (TypeScript) |
| Admin Dashboard | PHP 8 + HTML/CSS/JS (XAMPP) |
| AI API Server | Python 3.11 + Flask |
| AI Models | TensorFlow/Keras, Ultralytics YOLOv8 |
| Database | MySQL 8 (via XAMPP) |
| Training Platform | Kaggle Notebooks (GPU T4 x2) |
| Mobile Build | Expo Application Services (EAS) |

---

## 📁 Project Structure

```
riceGuard/
├── app/                        # PHP Admin Dashboard
│   ├── admin/                  # Admin pages (dashboard, reports, users…)
│   ├── api/                    # PHP API endpoints for mobile
│   └── config/                 # DB configuration
├── flask_api/                  # Flask AI API Server
│   ├── app.py                  # Main Flask server & routes
│   ├── models.py               # Keras model loading & inference
│   ├── yolo_models.py          # YOLOv8 pipeline logic
│   ├── shrink_model.py         # Quantization helper
│   ├── requirements.txt        # Python dependencies
│   ├── trained_models/         # ← Place your .keras / .pt models here
│   └── uploads/                # Temporary image storage
├── mobile/                     # Expo React Native App
│   ├── app/                    # File-based routes (expo-router)
│   ├── components/
│   ├── services/
│   ├── app.json
│   └── eas.json
├── training/                   # Training scripts (run on Kaggle)
│   ├── train_models.py         # Keras model training (3 architectures)
│   ├── train_leaf_detector.py  # YOLOv8 leaf detector training
│   └── train_yolo.py           # YOLOv8 disease classifier training
└── rice_guard.sql              # Full database schema + seed data
```

---

## ✅ Prerequisites

| Tool | Version |
|---|---|
| Python | 3.10 – 3.11 |
| Node.js | 18 LTS or higher |
| XAMPP | 8.x (Apache + MySQL) |
| Expo CLI | Latest (`npm i -g expo-cli`) |
| EAS CLI | Latest (`npm i -g eas-cli`) |
| Kaggle Account | For GPU training (free tier) |

---

## 🤖 Training the Models

> **Recommended platform**: [Kaggle Notebooks](https://www.kaggle.com/) with GPU T4 x2 (free). All training scripts are pre-configured for Kaggle paths.

### Dataset

All models use the **Rice Diseases Data** dataset on Kaggle:

- **Kaggle Dataset slug**: `goatsandigan/rice-diseases-data`
- **Classes**: `Bacterial Leaf Blight`, `Leaf Blast`, `Sheath Blight`, `Healthy Rice Leaf`
- **Split**: `final_split/train` and `final_split/val`

**Adding the dataset to your Kaggle notebook:**
1. Open your notebook → click **Add Data**
2. Search `goatsandigan/rice-diseases-data` → Add

---

### Train Keras Models (MobileNetV2, DenseNet201, EfficientNetV2S)

Trains all three Keras classifiers with 5-fold cross-validation, ImageNet transfer learning, and fine-tuning.

**Script**: `training/train_models.py`

#### Steps on Kaggle:

1. Go to [kaggle.com/code](https://www.kaggle.com/code) → **New Notebook**
2. **Settings** → Accelerator → **GPU T4 x2**
3. Add the dataset `goatsandigan/rice-diseases-data`
4. Paste the entire contents of `training/train_models.py` into a code cell
5. Run the cell

#### Key settings (top of file):

```python
DATA_PATH       = '/kaggle/input/datasets/goatsandigan/rice-diseases-data/final_split'
IMG_SIZE        = (224, 224)
BATCH_SIZE      = 32
EPOCHS          = 10      # Frozen base training epochs
FINETUNE_EPOCHS = 5       # Fine-tuning epochs
K_FOLDS         = 5
```

#### Output files (download from the Output tab):

```
MobileNetV2_rice_disease.keras
DenseNet201_rice_disease.keras
EfficientNetV2S_rice_disease.keras
training_results.csv
```

#### Optional — Quantize MobileNetV2 (TFLite, faster inference):

```bash
cd flask_api
python shrink_model.py
# Produces: trained_models/MobileNetV2_rice_disease_quantized.tflite
```

---

### Train YOLOv8 Leaf Detector

Trains the **Step 1 gatekeeper** — `rice_leaf_detector.pt` — that decides if an image contains a rice leaf.

**Script**: `training/train_leaf_detector.py`

#### Steps on Kaggle:

1. Create a notebook with **GPU T4 x2** and the rice dataset
2. Paste the entire `training/train_leaf_detector.py` script into a cell and run it

The script automatically:
- Builds a binary dataset: `rice_leaf` vs `not_rice_leaf`
- Generates synthetic non-leaf images (noise, gradients, patterns) as negatives
- Trains YOLOv8n-cls for 20 epochs

#### Key settings:

```python
RICE_DATASET = '/kaggle/input/datasets/goatsandigan/rice-diseases-data/final_split'
EPOCHS       = 20
IMG_SIZE     = 224
BATCH_SIZE   = 32
```

#### Output:

```
/kaggle/working/rice_leaf_detector.pt
```

Download from the **Output** tab.

---

### Train YOLOv8 Disease Classifier

Trains the **Step 2 YOLOv8 classifier** — `rice_disease_classifier.pt`.

**Script**: `training/train_yolo.py`

#### Steps on Kaggle:

```bash
# Paste and run in a Kaggle notebook cell:

# Disease classifier only:
!python train_yolo.py --mode cls \
  --dataset_cls /kaggle/input/datasets/goatsandigan/rice-diseases-data/final_split \
  --epochs 30

# Or train both leaf detector + classifier at once:
!python train_yolo.py --mode all \
  --dataset_cls /kaggle/input/datasets/goatsandigan/rice-diseases-data/final_split \
  --dataset_yaml /path/to/data.yaml \
  --epochs 30
```

#### Output:

```
flask_api/trained_models/rice_disease_classifier.pt
flask_api/trained_models/rice_leaf_detector.pt
```

---

### Placing Trained Models

After downloading from Kaggle, copy all model files into `flask_api/trained_models/`:

```
flask_api/trained_models/
├── MobileNetV2_rice_disease.keras
├── DenseNet201_rice_disease.keras
├── EfficientNetV2S_rice_disease.keras
├── MobileNetV2_rice_disease_quantized.tflite   ← optional
├── rice_leaf_detector.pt                        ← Step 1 (REQUIRED)
└── rice_disease_classifier.pt                   ← YOLOv8 Step 2
```

> ⚠️ **`rice_leaf_detector.pt` is required.** Without it, all image submissions will be rejected.

---

## 🚀 Deploying the Flask AI API

### Local Development

```bash
# 1. Navigate to the flask_api directory
cd flask_api

# 2. Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt
pip install tensorflow>=2.15.0   # (not in requirements.txt due to size)

# 4. Ensure trained models are in flask_api/trained_models/

# 5. Start the Flask development server
python app.py
```

API will be available at **http://localhost:5000**

Verify:

```bash
curl http://localhost:5000/
```

Expected:

```json
{
  "service": "RiceGuard AI API",
  "version": "4.0.0",
  "status": "running"
}
```

---

### Production — Linux Server

#### Option A: Gunicorn + Nginx (Recommended)

```bash
# Install Gunicorn
pip install gunicorn

# Run (foreground)
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Run in background
nohup gunicorn -w 4 -b 0.0.0.0:5000 app:app > flask.log 2>&1 &
```

#### Option B: Systemd Service

Create `/etc/systemd/system/riceguard-api.service`:

```ini
[Unit]
Description=RiceGuard Flask AI API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/riceGuard/flask_api
Environment="PATH=/var/www/riceGuard/flask_api/venv/bin"
ExecStart=/var/www/riceGuard/flask_api/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable riceguard-api
sudo systemctl start riceguard-api
sudo systemctl status riceguard-api
```

#### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass         http://127.0.0.1:5000/;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        client_max_body_size 10M;
    }
}
```

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🖥 Deploying the PHP Admin Dashboard

The admin dashboard runs on XAMPP (Apache + MySQL).

### 1. Install XAMPP

1. Download and install [XAMPP](https://www.apachefriends.org/)
2. Start **Apache** and **MySQL** from the XAMPP Control Panel

### 2. Copy Project Files

Copy the entire project into XAMPP's web root:

```
C:\xampp\htdocs\riceGuard\
```

### 3. Import the Database

1. Open **phpMyAdmin**: `http://localhost/phpmyadmin`
2. Create a new database named `rice_guard_db`
3. Click the database → **Import** → select `rice_guard.sql` → **Go**

### 4. Configure Database Connection

The Flask API DB config is in `flask_api/app.py`:

```python
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',          # default XAMPP password (empty)
    'database': 'rice_guard_db',
}
```

Update the PHP config in `app/config/` to match.

### 5. Seed Treatment Data

Run the populate script once to insert PhilRice treatment recommendations:

```
http://localhost/riceGuard/riceGuard/populate_treatments.php
```

### 6. Access the Dashboard

```
http://localhost/riceGuard/riceGuard/app/admin/index.php
```

---

## 📱 Deploying the Mobile App

The mobile app is built with **Expo** (React Native + TypeScript).

### Development with Expo Go

```bash
# 1. Navigate to the mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Configure the API base URL
# Edit services/ or constants/ to point to your Flask server:
# e.g., API_BASE_URL = 'http://192.168.x.x:5000'
# (Use your computer's local IP, not 'localhost')

# 4. Start the Expo dev server
npx expo start
```

Scan the QR code with the **Expo Go** app (Android / iOS) to run on your device.

> 💡 Your phone and computer must be on the **same Wi-Fi network**.

---

### Preview Build (APK)

Generates an installable `.apk` for internal testing without the Play Store.

```bash
# 1. Login to your Expo account
eas login

# 2. Build APK
eas build --platform android --profile preview
```

Download the `.apk` from [expo.dev](https://expo.dev) → **Projects** → your build, then install it on your Android device.

The EAS build profile is already configured in `eas.json`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

---

### Production Build (App Bundle)

Generates an `.aab` for Google Play Store submission.

```bash
# Build
eas build --platform android --profile production

# Submit to Play Store (requires Google Play credentials configured)
eas submit --platform android
```

---

## 📡 API Reference

**Base URL**: `http://localhost:5000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and model list |
| `GET` | `/models` | All models with accuracy info |
| `GET` | `/pipeline` | Interactive pipeline diagram (HTML) |
| `GET` | `/pipeline/info` | Pipeline structure as JSON |
| `POST` | `/predict` | Analyze an image (2-step pipeline) |
| `POST` | `/predict/yolo` | YOLOv8-only 2-step pipeline |
| `POST` | `/predict/compare` | Run all models and compare results |

### POST `/predict`

```bash
curl -X POST http://localhost:5000/predict \
  -F "image=@/path/to/leaf.jpg" \
  -F "model=mobilenetv2"
```

**Form fields:**

| Field | Required | Values |
|---|---|---|
| `image` | ✅ | Image file (JPG / PNG) |
| `model` | ✅ | `mobilenetv2`, `densenet201`, `efficientnetv2s`, `yolov8` |
| `report_id` | ❌ | Saves AI diagnosis to DB when provided |

**Example response (success):**

```json
{
  "status": "success",
  "pipeline": "unified_2step",
  "step1_is_rice_leaf": true,
  "step1_confidence": 97.4,
  "disease_name": "Leaf Blast",
  "disease_id": 2,
  "confidence_score": 94.2,
  "is_healthy": false,
  "inference_time_ms": 83.4,
  "model_used": "mobilenetv2"
}
```

**Example response (rejected — not a rice leaf):**

```json
{
  "status": "rejected",
  "step1_is_rice_leaf": false,
  "message": "No rice leaf detected in the image. Please upload a clear photo of a rice leaf."
}
```

---

## 🗄 Database Setup

The full schema is in `rice_guard.sql`. Key tables:

| Table | Description |
|---|---|
| `tbl_users` | App users (farmers, field officers, admins) |
| `tbl_reports` | Disease reports submitted via the mobile app |
| `tbl_ai_diagnosis` | AI model predictions linked to reports |
| `tbl_diseases` | Disease reference table (4 classes) |
| `tbl_treatments` | PhilRice treatment recommendations |
| `tbl_field_visits` | Field officer visit scheduling |
| `tbl_claims` | Farmer insurance / assistance claims |

**Import via CLI:**

```bash
mysql -u root -p rice_guard_db < rice_guard.sql
```

---

## ⚙️ Environment Configuration

### Flask API

Edit `flask_api/app.py`:

```python
DB_CONFIG = {
    'host': 'localhost',      # MySQL host
    'user': 'root',           # MySQL username
    'password': '',           # MySQL password
    'database': 'rice_guard_db',
}
```

### Mobile App

Update the API base URL in `mobile/services/` or `mobile/constants/`:

```ts
// Example
export const API_BASE_URL = 'http://192.168.1.100:5000';
```

> ⚠️ On Android devices, `localhost` refers to the device itself — not your computer. Use your machine's local IP address (find it with `ipconfig` on Windows or `ifconfig` on macOS/Linux).

---

## 🏥 Detected Diseases

| ID | Disease | Description |
|---|---|---|
| 1 | Bacterial Leaf Blight | Water-soaked to yellowish stripe on leaf margins |
| 2 | Leaf Blast | Diamond-shaped lesions with gray center on leaves |
| 3 | Sheath Blight | Irregular greenish-gray lesions on the leaf sheath |
| — | Healthy Rice Leaf | No disease detected |

---

## 📄 License

This project is developed for academic and agricultural research purposes.
import sys
import os
import torch
import numpy as np
from datetime import datetime, timedelta
import yaml

model_path = os.path.join(os.path.dirname(__file__), 'DLTTS')
if model_path not in sys.path:
    sys.path.append(model_path)
    print(f"Added DLTTS path: {model_path}")

try:
    from Utils.io_utils import instantiate_from_config
    print("Successfully imported instantiate_from_config")
except ImportError as e:
    print(f"Error importing instantiate_from_config: {e}")
    def instantiate_from_config(config):
        print("Using fallback instantiate_from_config")
        return None

class DLTTSService:
    def __init__(self, device_id=1):
        self.model = None
        self.device_id = device_id
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {self.device}")
        
        # Dataset configuration mapping
        # name = folder name in INF_BMC_OUTPUT
        # file_prefix = prefix in .npy file names (for predict and impute)
        # gen_prefix = prefix for generation files (if different)
        # feat_idx = index of target feature (0-index)
        self.config_map = {
            1: {  # ETTh
                'name': 'etth',
                'file_prefix': 'etth',
                'seq_len': 32,
                'feat_idx': 6,
                'config': 'DLTTS/Config/etth/etth32.yaml',
                'checkpoint': 'DLTTS/Checkpoints_etth_32/checkpoint-10.pt'
            },
            2: {  # ETTm1
                'name': 'ettm1',
                'file_prefix': 'ettm1',
                'gen_prefix': 'ettm',
                'seq_len': 32,
                'feat_idx': 6,
                'config': 'DLTTS/Config/ettm1/ettm1_32.yaml',
                'checkpoint': 'DLTTS/Checkpoints_ettm1_32/checkpoint-10.pt'
            },
            5: {  # Xinan
                'name': 'xinan',
                'file_prefix': 'xinan',
                'seq_len': 32,
                'feat_idx': 0,
                'config': 'DLTTS/Config/xinan/xinan32.yaml',
                'checkpoint': 'DLTTS/Checkpoints_xinan/checkpoint-10.pt'
            },
            6: {  # SWaT
                'name': 'swat',
                'file_prefix': 'swat',
                'seq_len': 32,
                'feat_idx': 1,
                'config': 'DLTTS/Config/swat/swat_32.yaml',
                'checkpoint': 'DLTTS/Checkpoints_swat_32/checkpoint-10.pt'
            },
            7: {  # Energy
                'name': 'energy',
                'file_prefix': 'energy',
                'seq_len': 24,
                'feat_idx': 0,
                'config': 'DLTTS/Config/energy.yaml',
                'checkpoint': 'DLTTS/Checkpoints_energy/checkpoint-10.pt'
            },
            8: {  # Stocks
                'name': 'stocks',
                'file_prefix': 'stocks',
                'gen_prefix': 'stock',
                'seq_len': 24,
                'feat_idx': 3,
                'config': 'DLTTS/Config/stocks.yaml',
                'checkpoint': 'DLTTS/Checkpoints_stocks/checkpoint-10.pt'
            },
        }
    def get_dataset_info(self, device_id):
        """Get dataset info for a device"""
        if device_id not in self.config_map:
            return None
        return self.config_map[device_id]
        
    def load_model(self):
        """Load pre-trained model (legacy, not used for file-based access)"""
        try:
            if self.device_id not in self.config_map:
                print(f"Device {self.device_id} config not found")
                return False
                
            config_path = self.config_map[self.device_id]['config']
            checkpoint_path = self.config_map[self.device_id]['checkpoint']
            
            print(f"Loading model for device {self.device_id}...")
            print(f"Config: {config_path}")
            print(f"Checkpoint: {checkpoint_path}")
            
            if not os.path.exists(config_path):
                print(f"Config file not found: {config_path}")
                return False
            if not os.path.exists(checkpoint_path):
                print(f"Checkpoint file not found: {checkpoint_path}")
                return False
            
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            print("Config loaded successfully")
            
            print("Instantiating model...")
            self.model = instantiate_from_config(config['model']).to(self.device)
            print("Model instantiated successfully")
            
            print(f"Loading checkpoint from {checkpoint_path}...")
            checkpoint = torch.load(checkpoint_path, map_location=self.device)
            
            if isinstance(checkpoint, dict):
                if 'model' in checkpoint:
                    self.model.load_state_dict(checkpoint['model'])
                    print("Loaded state dict from checkpoint['model']")
                else:
                    self.model.load_state_dict(checkpoint)
                    print("Loaded state dict directly from checkpoint")
            else:
                self.model = checkpoint
                print("Checkpoint is the model itself")
                    
            print("Model loaded successfully")
            self.model.eval()
            return True
            
        except Exception as e:
            print(f"Error loading model: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def predict_from_file(self, device_id, steps=12):
        """Read prediction data from cached file"""
        try:
            info = self.get_dataset_info(device_id)
            if not info:
                print(f"Device {device_id} not found in config")
                return None
            
            name = info['name']
            prefix = info['file_prefix']
            seq_len = info['seq_len']
            feat_idx = info['feat_idx']
            
            pred_file = f"{os.path.dirname(__file__)}/DLTTS/INF_BMC_OUTPUT/{name}/predict_sample/0_ddpm_predict_{prefix}_{seq_len}_{steps}.npy"
            
            if not os.path.exists(pred_file):
                print(f"Prediction file not found: {pred_file}")
                return None
            
            predictions = np.load(pred_file)
            # Return only the first 'steps' values
            temp_values = predictions[0, :steps, feat_idx].tolist()
            return temp_values
            
        except Exception as e:
            print(f"Error reading prediction file: {e}")
            return None
    
    def impute_from_file(self, device_id, ratio=0.6):
        """Read imputation data from cached file"""
        try:
            info = self.get_dataset_info(device_id)
            if not info:
                print(f"Device {device_id} not found in config")
                return None
            
            name = info['name']
            prefix = info['file_prefix']
            seq_len = info['seq_len']
            
            impute_file = f"{os.path.dirname(__file__)}/DLTTS/INF_BMC_OUTPUT/{name}/infill_sample/0_ddpm_infill_{prefix}_{seq_len}_{ratio}.npy"
            mask_file = f"{os.path.dirname(__file__)}/DLTTS/INF_BMC_OUTPUT/{name}/infill_sample/ddpm_infill_masks_{ratio}_{prefix}_{seq_len}.npy"
            
            if not os.path.exists(impute_file):
                print(f"Imputation file not found: {impute_file}")
                return None
            
            imputed_data = np.load(impute_file)
            # Return only the first sample to reduce data size
            result = {
                "imputed_data": imputed_data[0].tolist(),
                "mask": None
            }
            
            if os.path.exists(mask_file):
                mask = np.load(mask_file)
                result["mask"] = mask[0].tolist() if len(mask.shape) > 1 else mask.tolist()
            
            return result
            
        except Exception as e:
            print(f"Error reading imputation file: {e}")
            return None
    
    def generate_from_file(self, device_id, num_samples=100):
        """Read generation data from cached file"""
        try:
            info = self.get_dataset_info(device_id)
            if not info:
                print(f"Device {device_id} not found in config")
                return None
            
            name = info['name']
            # Use gen_prefix if exists, otherwise use file_prefix
            prefix = info.get('gen_prefix', info['file_prefix'])
            seq_len = info['seq_len']
            feat_idx = info['feat_idx']
            
            gen_file = f"{os.path.dirname(__file__)}/DLTTS/INF_BMC_OUTPUT/{name}/samples/{prefix}_ground_truth_{seq_len}_train.npy"
            
            if not os.path.exists(gen_file):
                print(f"Generation file not found: {gen_file}")
                return None
            
            all_samples = np.load(gen_file)
            
            # Sample random indices
            num_to_sample = min(num_samples, len(all_samples))
            indices = np.random.choice(len(all_samples), num_to_sample, replace=False)
            selected = all_samples[indices]
            
            # Extract target feature (temperature or main value)
            temp_values = selected[:, :, feat_idx].tolist()
            
            return {
                "num_samples": num_to_sample,
                "seq_length": seq_len,
                "generated_data": temp_values
            }
            
        except Exception as e:
            print(f"Error reading generation file: {e}")
            return None
            
    def get_pca_visualization(self, device_id, num_samples=500):
        """Get PCA visualization data for real and generated samples"""
        try:
            info = self.get_dataset_info(device_id)
            if not info:
                print(f"Device {device_id} not found in config")
                return None
            
            name = info['name']
            seq_len = info['seq_len']
            
            real_file = f"{os.path.dirname(__file__)}/DLTTS/INF_BMC_OUTPUT/{name}/samples/{name}_ground_truth_{seq_len}_train.npy"
            gen_file = f"{os.path.dirname(__file__)}/DLTTS/INF_BMC_OUTPUT/{name}/samples/{name}_norm_truth_{seq_len}_train.npy"
            
            if not os.path.exists(real_file) or not os.path.exists(gen_file):
                print(f"Files not found for device {device_id}")
                return None
            
            real_data = np.load(real_file)
            gen_data = np.load(gen_file)
            
            real_samples = real_data[:num_samples]
            gen_samples = gen_data[:num_samples]
            
            real_flat = real_samples.reshape(real_samples.shape[0], -1)
            gen_flat = gen_samples.reshape(gen_samples.shape[0], -1)
            
            from sklearn.decomposition import PCA
            combined = np.vstack([real_flat, gen_flat])
            pca = PCA(n_components=2)
            combined_2d = pca.fit_transform(combined)
            
            n_real = real_flat.shape[0]
            result = {
                "real": combined_2d[:n_real].tolist(),
                "generated": combined_2d[n_real:].tolist()
            }
            return result
            
        except Exception as e:
            print(f"Error generating PCA visualization: {e}")
            return None

# Create global instance
print("Creating DLTTSService instance...")
dltss_service = DLTTSService(device_id=1)
print("DLTTSService instance created")
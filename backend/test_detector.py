from services.detector import detect_damage


image_path = r"C:\Users\kisha\CivicPulse-AI\data\test.jpg"

detections = detect_damage(image_path)

print("=== CivicPulse YOLO Detection ===")
print("Number of detections:", len(detections))

for detection in detections:
    print(detection)
import os
from gradio_client import Client
import gradio_client

print(f"📦 gradio_client 버전: {gradio_client.__version__}")

# 환경 변수에서 HuggingFace 토큰 가져오기
hf_token = os.getenv("HUGGINGFACE_TOKEN")

if not hf_token:
    print("❌ HUGGINGFACE_TOKEN 환경 변수가 설정되지 않았습니다.")
    exit(1)

print(f"✅ HuggingFace 토큰 로드 완료")

# HF_TOKEN 환경 변수도 설정 (일부 버전에서 필요)
os.environ["HF_TOKEN"] = hf_token

# Gradio Client 초기화 (Private Space이므로 토큰 필수)
print(f"🔗 Gradio Client 연결 중: samyeool/kookmin_project")
try:
    client = Client("samyeool/kookmin_project", token=hf_token)
    print(f"✅ Gradio Client 연결 성공")
except Exception as e:
    print(f"❌ 연결 실패: {e}")
    exit(1)

# 테스트 텍스트들
test_texts = [
    "이 텍스트가 유해한지 검사해줘",
    "안녕하세요, 좋은 하루 되세요!",
    "너는 정말 바보야"
]

print("\n" + "="*60)
print("유해 콘텐츠 감지 테스트 시작")
print("="*60)

for i, text in enumerate(test_texts, 1):
    print(f"\n[테스트 {i}] 입력 텍스트: {text}")
    try:
        result = client.predict(text, api_name="/predict")
        print(f"결과: {result}")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

print("\n" + "="*60)
print("테스트 완료")
print("="*60)

# 바른글 교정기

기안문·공문서 맞춤법 교정 및 순우리말 변환 도구

## 기능
- ✅ 맞춤법·띄어쓰기 교정 (부산대 한국어 맞춤법 검사기)
- ✅ 외래어 → 순우리말 변환 (국립국어원 다듬은말)
- ✅ 한자어 → 순우리말 변환
- ✅ 변경 부분 강조 표시
- ✅ 완전 무료, 로그인 불필요

## Netlify 배포 방법

### 1. GitHub 저장소 만들기
1. [github.com](https://github.com) 로그인
2. New repository 클릭
3. 이 폴더의 파일들을 모두 업로드

### 2. Netlify 연결
1. [netlify.com](https://netlify.com) 로그인 (GitHub 계정으로 가능)
2. "Add new site" → "Import an existing project"
3. GitHub 저장소 선택
4. 빌드 설정 (자동 감지됨):
   - Build command: 비워두기
   - Publish directory: `.`
5. "Deploy site" 클릭

### 3. 완료!
- Netlify가 자동으로 URL 생성 (예: https://bareugeul.netlify.app)
- 이 링크로 누구나 무료로 사용 가능

## 파일 구조
```
├── index.html                    # 메인 페이지
├── netlify.toml                  # Netlify 설정
├── netlify/
│   └── functions/
│       └── spellcheck.js         # 맞춤법 검사 프록시 함수
└── README.md
```

## 출처
- 맞춤법: 부산대학교 한국어 맞춤법/문법 검사기 (https://speller.cs.pusan.ac.kr)
- 외래어·한자어: 국립국어원 다듬은말 (https://www.korean.go.kr)

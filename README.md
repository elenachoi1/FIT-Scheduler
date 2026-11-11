# FIT Scheduler

When2meet 같은 그룹 일정 조율 앱이에요. 디자인은 PRISM LCA 앱 스타일을 따랐어요.
GitHub Pages(무료 호스팅)와 Supabase(무료 데이터베이스 + 로그인)로 동작해요.

## 기능
- **로그인:** Google 로그인, 이메일/비밀번호 가입
- **그룹:** 그룹 만들기, 초대 링크로 참여, 그룹 이름 바꾸기(그룹장), 나가기·삭제
- **이벤트:** 날짜는 달력에서 드래그로 선택, 시간 범위와 칸 크기(15/30/60분) 설정
- **가능한 시간 입력:** 드래그로 선택하면 **자동 저장**
- **그룹 히트맵:** 다른 사람이 입력하면 바로 반영. 칸에 마우스를 올리면 누가 가능한지 표시
- **✨ 최적 시간 추천:** 회의 길이(30분~3시간)를 고르면 가장 많은 사람이 가능한 시간 Top 5를 보여줌. 클릭하면 히트맵에 표시
- **시간대:** 모든 시간은 **뉴욕 시간(ET)**
- 다크/라이트 테마 (PRISM과 동일)

## 파일 구조
```
index.html          앱 진입점
app.js              화면과 로직 전체
recommend.js        최적 시간 추천 알고리즘
styles.css          디자인 (맨 위 변수만 바꾸면 색상 변경)
config.js           ← Supabase 주소와 키를 여기에 입력
supabase/schema.sql ← Supabase에서 한 번 실행
```

---

## 설치 방법 (약 15분)

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 가입한 뒤 **New project**를 만들어요. 이름은 `fit-scheduler` 등으로 하면 돼요.
2. 왼쪽 메뉴 **SQL Editor** → **New query**를 열고 `supabase/schema.sql` 내용을 전부 붙여넣은 뒤 **Run**을 눌러요.
3. **Project Settings → API**에서 두 값을 복사해요.
   - `Project URL`
   - `anon public` key
4. `config.js`를 열어 두 값을 붙여넣어요.
   > anon key는 공개돼도 괜찮아요. 데이터는 schema.sql의 보안 규칙(RLS)이 보호해요.

### 2. GitHub에 올리기
1. GitHub에서 새 저장소를 만들어요. 예: `fit-scheduler`, Public
2. 이 폴더의 파일을 모두 올려요.
   ```bash
   cd fit-scheduler
   git init
   git add .
   git commit -m "FIT Scheduler"
   git branch -M main
   git remote add origin https://github.com/<내아이디>/fit-scheduler.git
   git push -u origin main
   ```
   또는 GitHub 웹에서 **Add file → Upload files**로 드래그해도 돼요.
3. 저장소 **Settings → Pages**에서 Source를 `Deploy from a branch`, Branch를 `main` / `/ (root)`로 정하고 **Save**를 눌러요.
4. 1~2분 뒤 `https://<내아이디>.github.io/fit-scheduler/` 주소가 생겨요.

### 3. 로그인 설정 (Supabase)
**Authentication → URL Configuration**
- **Site URL:** `https://<내아이디>.github.io/fit-scheduler/`
- **Redirect URLs**에도 같은 주소를 추가

**이메일 로그인:** 기본으로 켜져 있어요. 가입하면 확인 메일이 와요. 테스트할 때 귀찮으면 *Authentication → Sign In / Providers → Email*에서 "Confirm email"을 꺼도 돼요.

**Google 로그인:** 선택 사항이에요. 설정하지 않으면 이메일 로그인만 쓰면 돼요.
1. https://console.cloud.google.com 에서 **APIs & Services → Credentials → Create Credentials → OAuth client ID**를 만들어요. 종류는 Web application이에요.
2. **Authorized redirect URI**에 Supabase의 *Authentication → Sign In / Providers → Google* 화면에 나오는 Callback URL을 넣어요.
3. 받은 Client ID와 Secret을 Supabase Google provider에 넣고 **Enable**을 눌러요.

### 4. 사용하기
1. 사이트에 로그인한 뒤 **Create group**으로 그룹을 만들어요.
2. 그룹 페이지에서 **Copy invite link**를 눌러 팀원에게 보내요.
3. **New event**에서 날짜와 시간을 정해요.
4. 각자 자기 시간을 드래그하면 자동 저장되고, 오른쪽에 최적 시간이 나와요.

## 로컬에서 테스트
```bash
cd fit-scheduler
python3 -m http.server 8000
# http://localhost:8000 접속 (Supabase Redirect URLs에 http://localhost:8000 도 추가)
```

## 디자인 바꾸기
`styles.css` 맨 위 `:root` 블록의 색상 변수만 바꾸면 전체가 바뀌어요.
`--heat-rgb`는 히트맵 색이고, `--mine`은 내가 선택한 칸 색이에요.

## 권한 규칙
| 기능 | 누가 할 수 있나 |
|---|---|
| 그룹·이벤트 보기 | 그룹 멤버만 |
| 그룹 이름 변경·삭제 | 그룹장 |
| 이벤트 만들기 | 그룹 멤버 누구나 |
| 이벤트 삭제 | 만든 사람 |
| 가능 시간 수정 | 본인 것만 |

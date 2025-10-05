# Frontend Dockerfile
FROM node:18-alpine as build

# 작업 디렉토리 설정
WORKDIR /app

# npm cache 정리
RUN npm cache clean --force

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치 (rollup 문제 해결)
RUN npm install

# 소스 코드 복사
COPY . .

# 애플리케이션 빌드
RUN npm run build

# Production stage
FROM nginx:alpine

# nginx 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 빌드된 파일을 nginx로 복사
COPY --from=build /app/dist /usr/share/nginx/html

# 포트 노출
EXPOSE 80

# nginx 실행
CMD ["nginx", "-g", "daemon off;"] 
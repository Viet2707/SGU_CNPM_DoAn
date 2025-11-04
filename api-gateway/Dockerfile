# 🟩 Base image Debian, ổn định DNS giống auth-service
FROM node:18

# 🧱 Set working directory
WORKDIR /app

# 📦 Copy package files
COPY package*.json ./

# ⚙️ Install dependencies
RUN npm install --production

# 📁 Copy source code
COPY . .

# 🌐 Expose port 8000
EXPOSE 8000

# 🚀 Start API Gateway
CMD ["node", "index.js"]

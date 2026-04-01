FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    libpq-dev \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
COPY wheels/ ./wheels/
RUN if find ./wheels -maxdepth 1 -name '*.whl' | grep -q .; then \
        pip install --no-cache-dir --no-index --find-links=./wheels -r requirements.txt; \
    else \
        pip install --no-cache-dir -r requirements.txt \
        || pip install --no-cache-dir --index-url https://pypi.doubanio.com/simple -r requirements.txt \
        || pip install --no-cache-dir --index-url https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt; \
    fi

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


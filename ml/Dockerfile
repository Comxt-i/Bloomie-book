FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 ML_HOST=0.0.0.0 ML_PORT=4190
WORKDIR /app
COPY ml/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && groupadd --system app \
    && useradd --system --gid app app
COPY --chown=app:app ml/service.py ./service.py
USER app
EXPOSE 4190
CMD ["python", "service.py"]

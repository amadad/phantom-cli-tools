import modal, yaml, pathlib
from workflows.social_pipeline import SocialPipeline

app = modal.App("agno-social-mvp")
image = modal.Image.debian_slim(python_version="3.10").pip_install_from_requirements("requirements.txt")

pipeline = SocialPipeline()

@app.function(image=image, schedule=modal.Period(hours=6), timeout=900)
async def scheduled():
    return await pipeline.run()

@app.function(image=image)
@modal.web_endpoint(method="POST")
async def trigger(data: dict):
    return await pipeline.run(data.get("topic", "caregiver burnout"))

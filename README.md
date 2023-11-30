# Arxiv-researcher
Arxiv-researcher helps you to understand and gain insights from Arxiv research papers faster by allowing you to chat with the research paper.
Under the hood, the Arxiv paper gets downloaded and the text is extracted from the PDF and is converted into embeddings which are then stored in a vector database. When the user asks a question, the vector database retrieves relevant passages and then GPT summarises them, resulting in a coherent answer.

# Get Started
0. Get your openai api key: https://platform.openai.com/api-keys
   
1. clone the repo
```python
git clone https://github.com/hrushik98/Arxiv-researcher
```

2. Install the requirements
```python
pip install -r requirements.txt
```

3. Run the app
```python
streamlit run app.py
```

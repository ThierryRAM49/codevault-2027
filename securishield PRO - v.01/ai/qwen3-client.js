const axios = require('axios');

// Appel sécurisé à Qwen3 (Alibaba Cloud)
exports.callQwen3 = async (prompt) => {
  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-plus',
        input: { prompt },
        parameters: { result_format: 'text' }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    return response.data.output.text;
  } catch (error) {
    console.error('[Qwen3] API Error:', error.message);
    return "❌ Erreur de connexion à Qwen3.";
  }
};

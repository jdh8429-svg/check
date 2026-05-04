exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text } = JSON.parse(event.body);
    if (!text) return { statusCode: 400, body: 'text is required' };

    const response = await fetch('https://speller.town', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error('맞춤법 서버 오류: ' + response.status);

    const data = await response.json();

    // suggestions 형식을 기존 형식으로 변환
    const errInfo = (data.suggestions || []).map(s => ({
      orgStr: s.text,
      candWord: (s.candidates || []).join('|'),
      help: s.description || '맞춤법 오류',
    }));

    let corrected = text;
    for (const err of errInfo) {
      if (err.candWord) {
        const best = err.candWord.split('|')[0].trim();
        if (best) corrected = corrected.replace(err.orgStr, best);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ errInfo, corrected }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

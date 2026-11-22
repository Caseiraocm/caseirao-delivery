'use strict';

(() => {
  // Public project key for the Supabase gateway. The OpenAI key lives in Edge Function secrets.
  const projectKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpodnRqaGp6bGxqcWZ6ZGNjcnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTYzMTUsImV4cCI6MjEwNDQ5MjMxNX0.J3sURJyCeVQkuCV34ecNi-iKEqUZYQBDgo1G-PY2y7s';
  const endpoint = 'https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/caseirao-assistant';
  const privateData = /@|\d(?:[\s().+-]*\d){6,}|\b(?:cep|cpf|rg|senha|chave\s+pix|meu\s+(?:nome|telefone|endere[cç]o|whatsapp)|me\s+chamo|moro\s+na|(?:rua|avenida|travessa)\s+[^.?!]{1,60}\d)\b/iu;
  let unavailableUntil = 0;

  function eligible(text) {
    return typeof text === 'string' && text.trim() && !privateData.test(text.normalize('NFKC'));
  }

  async function interpret(context) {
    if (Date.now() < unavailableUntil || !eligible(context.message) ||
        !/^https:\/\/(?:www\.)?caseiraopedidos\.api\.br$|^https:\/\/caseiraocm\.github\.io$/i.test(location.origin)) return [];
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {apikey:projectKey, Authorization:'Bearer '+projectKey, 'Content-Type':'application/json'},
        body: JSON.stringify({...context,recent:eligible(context.recent)?context.recent:''}),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        if ([401,403,404,429,503].includes(response.status)) unavailableUntil=Date.now()+120_000;
        return [];
      }
      const result=await response.json();
      return Array.isArray(result.actions)?result.actions.slice(0,5):[];
    } catch {
      unavailableUntil=Date.now()+30_000;
      return [];
    }
  }

  window.caseiraoAssistantAI={interpret,eligible};
})();

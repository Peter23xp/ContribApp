export interface GeminiAnalysis {
  isPaymentProof: boolean;
  amount: number | null;
  currency: 'CDF' | 'USD' | null;
  operator: 'airtel' | 'orange' | 'mpesa' | 'mtn' | null;
  transactionRef: string | null;
  detectedDate: string | null;
  recipientPhone: string | null;
  senderPhone: string | null;
  confidence: number;
  rawText: string;
  warningFlags: string[];
}

const GEMINI_MODEL = 'gemini-2.0-flash';

const PROMPT_TEXTE = `Tu es un expert en analyse de confirmations de paiement Mobile Money en République Démocratique du Congo (RDC).

Analyse cette image — il peut s'agir d'une capture d'écran d'application, d'un SMS, ou d'une notification push.

Opérateurs Mobile Money RDC :
- Airtel Money (Airtel RDC)
- Orange Money (Orange RDC)
- M-Pesa (Vodacom RDC)
- MTN MoMo (MTN RDC)

Devises : CDF (Franc Congolais, aussi écrit FC ou F) ou USD (Dollar américain).
Les montants CDF sont souvent écrits avec des points : "5.000 FC" = 5000 CDF.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après :
{
  "isPaymentProof": boolean,
  "amount": number | null,
  "currency": "CDF" | "USD" | null,
  "operator": "airtel" | "orange" | "mpesa" | "mtn" | null,
  "transactionRef": string | null,
  "detectedDate": string | null,
  "recipientPhone": string | null,
  "senderPhone": string | null,
  "confidence": number,
  "rawText": string,
  "warningFlags": string[]
}

Règles strictes :
- isPaymentProof=false si l'image n'est PAS une confirmation de paiement réussie
- isPaymentProof=false si le paiement est en échec, annulé ou en attente
- amount : extraire uniquement le nombre entier (ex: "5.000 FC" → 5000)
- confidence : 0-100, ta certitude sur l'exactitude des données extraites
- warningFlags : liste tout ce qui est suspect, flou, tronqué ou incohérent
- rawText : tout le texte lisible dans l'image, tel quel`;

const EMPTY_RESULT: GeminiAnalysis = {
  isPaymentProof: false,
  amount: null,
  currency: null,
  operator: null,
  transactionRef: null,
  detectedDate: null,
  recipientPhone: null,
  senderPhone: null,
  confidence: 0,
  rawText: '',
  warningFlags: ['reponse_ia_invalide'],
};

export async function analyzePaymentCapture(
  imageBase64: string,
  expectedAmount: number,
  expectedCurrency: 'CDF' | 'USD',
  expectedOperator?: string
): Promise<GeminiAnalysis> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'votre_cle_api_gemini_ici') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT_TEXTE },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (response.status === 429) throw new Error('GEMINI_QUOTA_EXCEEDED');
  if (response.status === 400) throw new Error('GEMINI_INVALID_REQUEST');
  if (response.status === 403) throw new Error('GEMINI_API_KEY_INVALID');
  if (!response.ok) throw new Error(`GEMINI_API_ERROR_${response.status}`);

  const data = await response.json();
  const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) return EMPTY_RESULT;

  // Extraire le JSON même si le modèle l'entoure de backticks
  let jsonString = textContent.trim();
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) jsonString = jsonMatch[1].trim();

  let analysis: GeminiAnalysis;
  try {
    analysis = JSON.parse(jsonString) as GeminiAnalysis;
  } catch {
    return { ...EMPTY_RESULT, rawText: textContent };
  }

  if (!Array.isArray(analysis.warningFlags)) {
    analysis.warningFlags = [];
  }

  // Vérification montant
  if (analysis.amount !== null && expectedAmount > 0) {
    const diff = Math.abs(analysis.amount - expectedAmount);
    if (diff > expectedAmount * 0.05) {
      analysis.warningFlags.push('montant_different_attendu');
    }
  }

  // Vérification opérateur
  if (expectedOperator && analysis.operator && analysis.operator !== expectedOperator) {
    analysis.warningFlags.push('operateur_different');
  }

  analysis.rawText = textContent;

  return analysis;
}

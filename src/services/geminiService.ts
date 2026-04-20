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

const PROMPT_TEXTE = `Tu es un assistant d'analyse de captures d'écran de paiement Mobile Money en RDC.
Analyse cette image et extrais les informations suivantes au format JSON strict.
Opérateurs connus : Airtel Money, Orange Money, M-Pesa (Vodacom), MTN MoMo.
Devises : CDF (Franc Congolais) ou USD.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, avec ces champs :
{
  "isPaymentProof": boolean,
  "amount": number | null,
  "currency": "CDF" | "USD" | null,
  "operator": "airtel" | "orange" | "mpesa" | "mtn" | null,
  "transactionRef": string | null,
  "detectedDate": string | null,
  "recipientPhone": string | null,
  "senderPhone": string | null,
  "confidence": number (0-100),
  "rawText": string,
  "warningFlags": string[]
}

Règles :
- Si l'image n'est pas une confirmation de paiement Mobile Money : isPaymentProof=false, confidence=0
- confidence doit refléter ta certitude globale sur l'exactitude des données extraites
- warningFlags doit lister tout ce qui est suspect, illisible ou manquant
- Pour le montant : extraire uniquement le nombre (ex: 5000, pas "5.000 CDF")`;

export async function analyzePaymentCapture(
  imageBase64: string,
  expectedAmount: number,
  expectedCurrency: 'CDF' | 'USD',
  expectedOperator?: string
): Promise<GeminiAnalysis> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT_TEXTE },
              { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          }
        })
      }
    );

    if (response.status === 429) {
      throw new Error('GEMINI_QUOTA_EXCEEDED');
    }

    if (!response.ok) {
      throw new Error(`API_ERROR: ${response.statusText}`);
    }

    const data = await response.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return {
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
        warningFlags: ['reponse_ia_invalide']
      };
    }

    // Attempt to extract JSON from the text, sometimes it comes with ```json ... ``` blocks
    let jsonString = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    }

    let analysis: GeminiAnalysis;
    try {
      analysis = JSON.parse(jsonString) as GeminiAnalysis;
    } catch (e) {
      return {
        isPaymentProof: false,
        amount: null,
        currency: null,
        operator: null,
        transactionRef: null,
        detectedDate: null,
        recipientPhone: null,
        senderPhone: null,
        confidence: 0,
        rawText: textContent,
        warningFlags: ['reponse_ia_invalide']
      };
    }

    // Ensure warningFlags is an array
    if (!analysis.warningFlags) {
      analysis.warningFlags = [];
    }

    // Verification
    if (analysis.amount !== null) {
      const difference = Math.abs(analysis.amount - expectedAmount);
      // Différence > 5% 
      if (difference > expectedAmount * 0.05) {
        analysis.warningFlags.push('montant_different_attendu');
      }
    }

    if (expectedOperator && analysis.operator !== null && analysis.operator !== expectedOperator) {
      analysis.warningFlags.push('operateur_different');
    }

    // Save the raw text for reference
    analysis.rawText = textContent;

    return analysis;
  } catch (error: any) {
    if (error.message === 'GEMINI_QUOTA_EXCEEDED') {
      throw error;
    }
    throw new Error(`Gemini analysis failed: ${error.message}`);
  }
}

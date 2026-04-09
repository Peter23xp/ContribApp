export const OPERATORS = [
  {
    id: 'airtel',
    name: 'Airtel Money',
    color: '#FF0000',
    prefixes: ['97', '98'],
    logo: require('../../assets/images/airtel.png'),
    instructions: 'Vous allez recevoir une notification Airtel. Entrez votre PIN Airtel pour confirmer.',
  },
  {
    id: 'orange',
    name: 'Orange Money',
    color: '#FF8C00',
    prefixes: ['89', '84'],
    logo: require('../../assets/images/orange.png'),
    instructions: 'Composez *183# ou attendez le USSD push Orange. Entrez votre PIN pour confirmer.',
  },
  {
    id: 'mpesa',
    name: 'M-Pesa',
    color: '#00A651',
    prefixes: ['81', '82', '83'],
    logo: require('../../assets/images/m-pesa.png'),
    instructions: 'Vous allez recevoir une notification M-Pesa. Entrez votre PIN M-Pesa pour confirmer.',
  },
  {
    id: 'mtn',
    name: 'MTN MoMo',
    color: '#FFCC00',
    prefixes: ['90', '91'],
    logo: require('../../assets/images/mtn.png'),
    instructions: "Un SMS OTP va vous être envoyé. Confirmez ensuite sur l'application MTN.",
  },
];

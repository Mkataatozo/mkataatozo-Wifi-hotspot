/**
 * Dual Language Support: English & Kiswahili for HotspotTZ
 */

export const translations = {
  en: {
    // Branding & Header
    appName: 'HotspotTZ',
    welcomeTitle: 'Welcome to',
    welcomeSubtitle: 'Fast & Reliable Internet. Choose a time package below to get connected instantly.',
    language: 'Language',
    
    // Package selection
    packagesTitle: 'Select Internet Package',
    packagesSubtitle: 'All packages are 100% time-based with unlimited bandwidth during your session.',
    duration: 'Duration',
    price: 'Price',
    minutes: 'Minutes',
    hours: 'Hours',
    days: 'Days',
    popular: 'Most Popular',
    selectPackage: 'Choose Package',
    payToConnect: 'Pay & Connect',
    
    // Payment Options
    paymentChoiceTitle: 'Select Payment Method',
    lipaKwaSimu: 'LIPA KWA SIMU',
    lipaKwaSimuDesc: 'Instant automatic activation via Mobile Money (M-Pesa, Tigo Pesa, Airtel Money, HaloPesa)',
    lipaCash: 'LIPA CASH',
    lipaCashDesc: 'Pay cash to the nearby hotspot manager & enter voucher code',
    
    // Mobile Payment Modal
    mobilePaymentTitle: 'Mobile Money Payment',
    mobilePaymentSubtitle: 'Enter your Tanzanian mobile number. You will receive an instant payment prompt on your phone.',
    phoneNumberLabel: 'Mobile Phone Number',
    phoneNumberPlaceholder: 'e.g. 0754 123 456 or 0655 123 456',
    phoneHelp: 'Supports Vodacom M-Pesa, Tigo Pesa, Airtel Money, and HaloPesa',
    payButton: 'LIPA SASA (PAY NOW)',
    processingPayment: 'Initiating payment request...',
    waitingForPin: 'Please approve the payment on your phone by entering your Mobile Money PIN.',
    verifyingTransaction: 'Payment received! Verifying with gateway and opening internet access...',
    paymentSuccess: 'Payment successful! Internet access authorized.',
    paymentFailed: 'Payment failed or timed out. Please try again.',
    cancel: 'Cancel',
    back: 'Back',
    
    // Cash Voucher Modal
    cashPaymentTitle: 'Pay Cash to Administrator',
    cashPaymentStep1: '1. Pay cash to the hotspot administrator nearby:',
    adminPhone: 'Admin Phone / WhatsApp',
    cashPaymentStep2: '2. Enter the Voucher Code given by the administrator:',
    voucherPlaceholder: 'Enter voucher code (e.g. TZ-941-8X2A)',
    connectWithVoucher: 'CONNECT WITH VOUCHER',
    validatingVoucher: 'Validating voucher...',
    voucherSuccess: 'Voucher valid! Connecting your device to the internet...',
    voucherError: 'Invalid or already used voucher code.',
    
    // Customer Dashboard ("MY INTERNET")
    myInternetTitle: 'MY INTERNET ACCESS',
    myInternetSubtitle: 'Your high-speed hotspot connection is currently active.',
    remainingTime: 'Remaining Time',
    activePackage: 'Active Package',
    startTime: 'Start Time',
    expiryTime: 'Expiry Time',
    deviceMac: 'Device MAC',
    deviceIp: 'Device IP',
    autoDisconnectNotice: 'When your time expires, access will automatically stop. You can renew at any time.',
    renewPackage: 'Buy Another Package',
    disconnect: 'Disconnect',
    
    // Help & Support
    helpSupport: 'Help & Support',
    supportContact: 'Hotspot Support',
    supportMessage: 'Having trouble connecting? Contact our on-site administrator directly.',
    callNow: 'Call Admin',
    whatsappNow: 'WhatsApp Support',
    
    // Captive Notice
    captiveNotice: 'Connected to Hotspot without internet yet. Complete payment or enter voucher to unlock full web access.',
    
    // Admin & Nav
    adminLogin: 'Admin Portal',
    adminPortalTitle: 'Hotspot Administration',
    dashboard: 'Dashboard',
    packages: 'Packages',
    vouchers: 'Vouchers',
    customers: 'Customers',
    payments: 'Payments',
    networkMikrotik: 'MikroTik RB941',
    reports: 'Reports',
    auditLogs: 'Audit Logs',
    settings: 'Settings',
    logout: 'Log Out',
    demoModeBadge: 'DEMO / SIMULATION MODE',
  },
  sw: {
    // Branding & Header
    appName: 'HotspotTZ',
    welcomeTitle: 'Karibu Kwenye',
    welcomeSubtitle: 'Mtandao wa Kasi na Uhakika. Chagua kifurushi cha muda hapa chini uunganishwe mara moja.',
    language: 'Lugha',
    
    // Package selection
    packagesTitle: 'Chagua Kifurushi cha Intaneti',
    packagesSubtitle: 'Vifurushi vyote viko kulingana na MUDA bila kikomo cha data/MB wakati wa matumizi.',
    duration: 'Muda',
    price: 'Bei',
    minutes: 'Dakika',
    hours: 'Saa',
    days: 'Siku',
    popular: 'Kipendwacho Zaidi',
    selectPackage: 'Chagua Kifurushi',
    payToConnect: 'Lipa & Unganishwa',
    
    // Payment Options
    paymentChoiceTitle: 'Chagua Njia ya Malipo',
    lipaKwaSimu: 'LIPA KWA SIMU',
    lipaKwaSimuDesc: 'Unganishwa kiotomatiki papo hapo kupitia M-Pesa, Tigo Pesa, Airtel Money, au HaloPesa',
    lipaCash: 'LIPA CASH',
    lipaCashDesc: 'Lipa pesa taslimu kwa msimamizi wa hotspot aliye karibu na upewe vocha',
    
    // Mobile Payment Modal
    mobilePaymentTitle: 'Malipo kwa Njia ya Simu',
    mobilePaymentSubtitle: 'Weka namba yako ya simu. Utapokea ombi la malipo (push notification/USSD) kwenye simu yako.',
    phoneNumberLabel: 'Namba ya Simu',
    phoneNumberPlaceholder: 'Mfano: 0754 123 456 au 0655 123 456',
    phoneHelp: 'Inakubali Vodacom M-Pesa, Tigo Pesa, Airtel Money, na HaloPesa',
    payButton: 'LIPA SASA',
    processingPayment: 'Inatuma ombi la malipo...',
    waitingForPin: 'Tafadhali thibitisha malipo kwenye simu yako kwa kuweka PIN yako ya siri.',
    verifyingTransaction: 'Malipo yamepokelewa! Tunathibitisha na kufungua intaneti...',
    paymentSuccess: 'Malipo yamekamilika! Intaneti imefunguliwa kiotomatiki.',
    paymentFailed: 'Malipo hayakufanikiwa. Tafadhali jaribu tena.',
    cancel: 'Ghairi',
    back: 'Rudi',
    
    // Cash Voucher Modal
    cashPaymentTitle: 'Lipa Pesa Taslimu (Cash)',
    cashPaymentStep1: '1. Lipa pesa taslimu kwa msimamizi aliye karibu nawe:',
    adminPhone: 'Namba ya Msimamizi',
    cashPaymentStep2: '2. Weka Nambari ya Vocha uliyopewa na msimamizi:',
    voucherPlaceholder: 'Weka namba ya vocha (mfano: TZ-941-8X2A)',
    connectWithVoucher: 'UNGANISHA KWA VOCHA',
    validatingVoucher: 'Inahakiki vocha...',
    voucherSuccess: 'Vocha imekubalika! Kifaa chako kinaunganishwa na intaneti sasa...',
    voucherError: 'Namba ya vocha siyo sahihi au imeshatumika.',
    
    // Customer Dashboard ("MY INTERNET")
    myInternetTitle: 'INTANETI YANGU',
    myInternetSubtitle: 'Muunganisho wako wa kasi uko hewani sasa hivi.',
    remainingTime: 'Muda Uliobaki',
    activePackage: 'Kifurushi Kilicho Hewani',
    startTime: 'Muda wa Kuanza',
    expiryTime: 'Muda wa Kuisha',
    deviceMac: 'MAC ya Kifaa',
    deviceIp: 'IP ya Kifaa',
    autoDisconnectNotice: 'Muda wako ukiisha, intaneti itajizima yenyewe kiotomatiki. Unaweza kununua kifurushi kingine.',
    renewPackage: 'Nunua Kifurushi Kingine',
    disconnect: 'Ondoka',
    
    // Help & Support
    helpSupport: 'Msaada & Mawasiliano',
    supportContact: 'Mawasiliano ya Hotspot',
    supportMessage: 'Je, unapata changamoto kuunganishwa? Wasiliana na msimamizi wa eneo hili moja kwa moja.',
    callNow: 'Piga Simu',
    whatsappNow: 'Tuma WhatsApp',
    
    // Captive Notice
    captiveNotice: 'Umeunganishwa na Wi-Fi lakini bado huna intaneti. Lipa kwa simu au weka vocha ili kufungua mtandao.',
    
    // Admin & Nav
    adminLogin: 'Mfumo wa Utawala',
    adminPortalTitle: 'Usimamizi wa Hotspot',
    dashboard: 'Dashibodi',
    packages: 'Vifurushi',
    vouchers: 'Vocha za Cash',
    customers: 'Wateja',
    payments: 'Malipo',
    networkMikrotik: 'MikroTik RB941',
    reports: 'Ripoti',
    auditLogs: 'Kumbukumbu',
    settings: 'Mipangilio',
    logout: 'Ondoka',
    
  }
};

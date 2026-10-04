export type Locale = 'en' | 'tl'

const LOCALE_KEY = 'lb-locale'

/**
 * Locale persistence layers:
 * 1. localStorage — instant client-side reads (existing behavior).
 * 2. Cookie — readable by Next.js server components during SSR, so
 *    server-rendered pages can translate without a client round-trip.
 *    `lb-locale` is non-sensitive, so lax SameSite is appropriate.
 */
export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return 'en'
  try {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${LOCALE_KEY}=`))
    return match?.split('=')[1] === 'tl' ? 'tl' : 'en'
  } catch {
    return 'en'
  }
}

function persistLocaleCookie(locale: Locale): void {
  try {
    // 1 year max-age; the cookie is rewritten on every locale change.
    document.cookie = `${LOCALE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`
  } catch {
    // Cookie writes may fail in restricted contexts; localStorage still works.
  }
}

/** ISO language code applied to <html lang> for accessibility. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: 'en',
  tl: 'fil-PH',
}

/**
 * Dictionary keyed by the English string.
 * Missing keys fall back to the key itself, so untranslated strings
 * degrade to English instead of breaking the UI.
 */
const dictionary: Record<string, string> = {
  // Navigation & common labels
  Dashboard: 'Dashboard',
  'Request Service': 'Humiling ng Serbisyo',
  'My Requests': 'Ang Aking mga Kahilingan',
  'My Complaints': 'Ang Aking mga Reklamo',
  'File Complaint': 'Magreklamo',
  Announcements: 'Mga Anunsyo',
  Notifications: 'Mga Abiso',
  'Document Pickups': 'Mga Pickup ng Dokumento',
  Offices: 'Mga Opisina',
  'Offices & Contacts': 'Mga Opisina at mga Contact',
  'Identity Verification': 'Beripikasyon ng Pagkakakilanlan',
  'Proxy Filing': 'Pag-file sa pamamagitan ng Kinatawan',
  Feedback: 'Feedback',
  'Verify ID': 'Beripikahin ang ID',
  'Sign Out': 'Mag-sign Out',
  'Welcome back': 'Maligayang pagbabalik',
  Track: 'Subaybayan',
  Submit: 'Ipasa',
  Cancel: 'Kanselahin',
  Search: 'Maghanap',
  Status: 'Katayuan',
  Loading: 'Naglo-load...',

  // Statuses
  Pending: 'Nakabinbin',
  Processing: 'Isinasagawa',
  Approved: 'Aprubado',
  Rejected: 'Tinanggihan',
  Completed: 'Tapos na',
  Claimed: 'Nakuha na',
  Cancelled: 'Kanselado',

  // Sidebar / logout dialog
  Logout: 'Mag-log Out',
  'Confirm Logout': 'Kumpirmahin ang Pag-log Out',
  'Are you sure you want to log out of your account?':
    'Sigurado ka bang gusto mong mag-log out sa iyong account?',
  'Open navigation menu': 'Buksan ang menu ng nabigasyon',
  'Close navigation menu': 'Isara ang menu ng nabigasyon',

  // Dashboard: recent requests card
  'Recent Requests': 'Mga Kamakailang Kahilingan',
  'Your latest service requests': 'Ang iyong mga pinakabagong kahilingan ng serbisyo',
  'View all': 'Tingnan lahat',
  'View All Requests': 'Tingnan ang Lahat ng Kahilingan',
  'No requests yet': 'Wala pang mga kahilingan',
  'Request a barangay clearance, certificate of residency, or any other service.':
    'Humingi ng barangay clearance, certificate of residency, o anumang iba pang serbisyo.',
  'Request a Service': 'Humiling ng Serbisyo',
  'Expected completion:': 'Inaasahang pagtatapos:',

  // Dashboard: recent complaints card
  'Recent Complaints': 'Mga Kamakailang Reklamo',
  'Your latest complaints': 'Ang iyong mga pinakabagong reklamo',
  'View All Complaints': 'Tingnan ang Lahat ng Reklamo',
  'No complaints filed': 'Walang nai-file na reklamo',
  'File a Complaint': 'Mag-file ng Reklamo',
  'Tracking number copied': 'Nakopya ang tracking number',
  'Could not copy the tracking number': 'Hindi makopya ang tracking number',

  // My Requests page
  'My Service Requests': 'Ang Aking mga Kahilingan ng Serbisyo',
  'Track all your submitted service requests': 'Subaybayan ang lahat ng iyong naisumiteng kahilingan ng serbisyo',
  '+ New Request': '+ Bagong Kahilingan',
  'Loading requests...': 'Naglo-load ang mga kahilingan...',
  'Submit your first service request to get started': 'Magsumite ng iyong unang kahilingan ng serbisyo para magsimula',
  'Create Request': 'Gumawa ng Kahilingan',
  'View Details': 'Tingnan ang Detalye',
  'Review the full request details submitted for processing.':
    'Suriin ang buong detalye ng kahilingan na isinumite para sa proseso.',
  'Submitted': 'Isinumite',
  'Expected completion': 'Inaasahang pagtatapos',
  'Priority:': 'Prayoridad:',

  // Request Services page
  'Request Services': 'Mga Serbisyong Hinihiling',
  'Browse and request available barangay services and documents':
    'Mag-browse at humiling ng mga available na serbisyo at dokumento ng barangay',
  'Note: Showing default services. Database unavailable.':
    'Paalala: Ipinapakita ang mga default na serbisyo. Hindi available ang database.',
  'Search services...': 'Maghanap ng mga serbisyo...',
  'Filter by category': 'Salain ayon sa kategorya',
  'All Services': 'Lahat ng Serbisyo',
  'General Services': 'Pangkalahatang mga Serbisyo',
  'Search:': 'Paghahanap:',
  'Category:': 'Kategorya:',
  'Loading services...': 'Naglo-load ang mga serbisyo...',
  'No services found': 'Walang nahanap na mga serbisyo',
  'Try adjusting your search or filters': 'Subukang baguhin ang iyong paghahanap o mga filter',
  'Reset Filters': 'I-reset ang mga Filter',

  // Feedback page
  'Submit Feedback': 'Magsumite ng Feedback',
  'My Feedback': 'Ang Aking Feedback',
  'Submit anonymously': 'Magsumite nang hindi nagpapakilala',
  'Your name will be hidden from barangay staff.':
    'Itatago ang iyong pangalan sa mga kawani ng barangay.',
  'Contact Name (optional)': 'Pangalan ng Contact (opsyonal)',
  'Contact Info (optional)': 'Impormasyon ng Contact (opsyonal)',
  'Your name': 'Ang iyong pangalan',
  'Mobile number or email': 'Numero ng mobile o email',
  'Brief summary of your feedback': 'Maikling buod ng iyong feedback',
  'Describe your feedback…': 'Ilarawan ang iyong feedback…',
  'Select a category': 'Pumili ng kategorya',
  'Category': 'Kategorya',
  'Subject': 'Paksa',
  'Details': 'Mga Detalye',
  'Anonymous': 'Hindi nagpapakilala',
  'No tracking number': 'Walang tracking number',
  'Barangay Response': 'Tugon ng Barangay',
  'Loading feedback…': 'Naglo-load ang feedback…',
  "You haven't submitted any feedback yet.":
    'Wala ka pang naisumiteng feedback.',
  'Please provide a subject (at least 5 characters).':
    'Magbigay ng paksa (hindi bababa sa 5 na karakter).',
  'Please provide more details (at least 10 characters).':
    'Magbigay ng higit pang detalye (hindi bababa sa 10 na karakter).',
  'You must be signed in to submit feedback.':
    'Kailangan mong naka-sign in para magsumite ng feedback.',
  'Resident profile not found.': 'Hindi nahanap ang profile ng residente.',
  'Feedback submitted. The barangay will acknowledge it within 2 working days.':
    'Naisumite ang feedback. Kikilalanin ito ng barangay sa loob ng 2 working days.',
  'Failed to submit feedback.': 'Hindi naisumite ang feedback.',
  'Responded on': 'Sinagot noong',

  // Offices page
  'Offices Directory': 'Direktoryo ng mga Opisina',
  "Contact details and service hours for barangay offices, based on the Citizen's Charter 2025.":
    'Mga detalye ng contact at oras ng serbisyo ng mga opisina ng barangay, batay sa Citizen\u2019s Charter 2025.',
  'For emergencies, call first': 'Sa mga emergency, tumawag muna',
  'Emergency Units': 'Mga Yunit ng Emergency',
  'Call these numbers directly for urgent assistance.':
    'Tumawag direkta sa mga numerong ito para sa agarang tulong.',
  'Barangay Offices': 'Mga Opisina ng Barangay',
  'Loading offices…': 'Naglo-load ang mga opisina…',
  'offices listed.': 'mga opisinang nakalista.',

  // Announcements page (server component)
  'Latest news and updates from {barangay}': 'Pinakabagong balita at mga update mula sa {barangay}',
  'Check back later for updates from {barangay}':
    'Balik-balikan sa ibang pagkakataon para sa mga update mula sa {barangay}',
  'No announcements yet': 'Wala pang mga anunsyo',
  'Pinned': 'Naka-pin',

  // File a Complaint page
  'Report issues or concerns with government services':
    'Iulat ang mga isyu o alalahanin tungkol sa mga serbisyo ng gobyerno',
  'Complaint Details': 'Detalye ng Reklamo',
  'Provide detailed information to help us address your concern promptly':
    'Magbigay ng detalyadong impormasyon para matugunan namin agad ang iyong alalahanin',
  'Complaint Title': 'Pamagat ng Reklamo',
  'Brief summary of your complaint': 'Maikling buod ng iyong reklamo',
  'Detailed Description': 'Detalyadong Paglalarawan',
  'Explain your complaint in detail. Include dates, names, and specific incidents...':
    'Ipaliwanag nang detalyado ang iyong reklamo. Isama ang mga petsa, pangalan, at mga partikular na pangyayari...',
  'Detected Priority': 'Nadetect na Prayoridad',
  'Critical': 'Kritikal',
  'High': 'Mataas',
  'Medium': 'Katamtaman',
  'Low': 'Mababa',
  'Pinpoint Complaint Location': 'Ituro ang Lokasyon ng Reklamo',
  'Loading map...': 'Naglo-load ang mapa...',
  'House no. & street': 'Numero ng bahay at kalye',
  'e.g. 123 Zambales Highway': 'hal. 123 Zambales Highway',
  'Add your house or unit number so responders can find you.':
    'Ilagay ang numero ng iyong bahay o unit para mahahanap ka ng mga responder.',
  'Barangay, city & ZIP': 'Barangay, lungsod at ZIP',
  'Evidence Photo (Optional)': 'Larawan ng Ebidensya (Opsyonal)',
  'Attach an image to support your complaint (max 5MB)':
    'Mag-attach ng larawan para suportahan ang iyong reklamo (max 5MB)',
  'Click to upload': 'I-click para mag-upload',
  'PNG, JPG or WEBP': 'PNG, JPG o WEBP',
  'File size must be less than 5MB': 'Dapat mas maliit sa 5MB ang laki ng file',
  'Evidence preview': 'Preview ng ebidensya',
  'Filing...': 'Ini-file...',
  'Failed to upload evidence image: {error}':
    'Hindi na-upload ang larawan ng ebidensya: {error}',
  'Failed to create complaint': 'Hindi magawa ang reklamo',
  'Failed to file complaint': 'Hindi na-file ang reklamo',
  'Complaint filed successfully': 'Matagumpay na na-file ang reklamo',
  'Not authenticated': 'Hindi naka-authenticate',
  'Resident profile not found': 'Hindi nahanap ang profile ng residente',

  // My Complaints page
  'Search complaints...': 'Maghanap ng mga reklamo...',
  'All Categories': 'Lahat ng Kategorya',
  'Clear filters': 'I-clear ang mga filter',
  'Clear Filters': 'I-clear ang mga Filter',
  'Loading complaints...': 'Naglo-load ang mga reklamo...',
  'File your first complaint to report an issue':
    'I-file ang iyong unang reklamo para iulat ang isyu',
  'No complaints match your search': 'Walang reklamong tugma sa iyong paghahanap',
  'Try adjusting your search or filter criteria':
    'Subukang baguhin ang iyong paghahanap o mga filter',
  'Attached Evidence:': 'Nakakabit na Ebidensya:',

  // Complaint statuses (lib/complaint-status.ts)
  'Open': 'Bukas',
  'Under Review': 'Isinasailalim sa review',
  'Resolved': 'Nalutas na',
  'Dismissed': 'Hindi dininig',
  'All Status': 'Lahat ng Katayuan',

  // Document Pickups page
  'Documents being processed for you. When a document is ready, present the claim code at the barangay hall — or share it with the person picking it up for you.':
    'Mga dokumentong pinoproseso para sa iyo. Kapag handa na ang dokumento, ipakita ang claim code sa barangay hall — o ibahagi ito sa taong kukuha nito para sa iyo.',
  'Could not load your document pickups. Please refresh the page.':
    'Hindi ma-load ang iyong mga pickup ng dokumento. Paki-refresh ang pahina.',
  'No document pickups yet. When barangay staff process one of your document requests, it will appear here.':
    'Wala pang pickup ng dokumento. Kapag pinroseso ng mga kawani ng barangay ang isa sa iyong mga kahilingan ng dokumento, lalabas ito dito.',
  'File one from Request Service': 'Mag-file sa pamamagitan ng Humiling ng Serbisyo',
  'Being prepared': 'Inihahanda',
  'Ready for pickup': 'Handa nang kunin',
  'Expected ready': 'Inaasahang handa',
  'Present claim code {code} at the barangay hall to release your document.':
    'Ipakita ang claim code {code} sa barangay hall para makuha ang iyong dokumento.',
  'Claimed on {date}': 'Nakuha noong {date}',
  'Print claim slip': 'I-print ang claim slip',
  'Your browser blocked the claim-slip window. Please allow pop-ups for this site and try again.':
    'Hinarang ng iyong browser ang claim-slip window. Pakayagan ang mga pop-up para sa site na ito at subukang muli.',

  // Verify ID page
  'Upload a valid government ID to verify your identity':
    'Mag-upload ng wastong government ID para beripikahin ang iyong pagkakakilanlan',
  'Verified': 'Beripikado',
  'Under Review (badge)': 'Nasa Review',
  'Not Verified': 'Hindi Beripikado',
  'Verification is required to file a service request':
    'Kailangan ng beripikasyon para makapag-file ng kahilingan ng serbisyo',
  'You were redirected here because your identity is not verified yet. Upload a valid government ID below to unlock service requests. You can still browse announcements, track your existing requests, and file complaints.':
    'Na-redirect ka dito dahil hindi pa beripikado ang iyong pagkakakilanlan. Mag-upload ng wastong government ID sa ibaba para ma-unlock ang mga kahilingan ng serbisyo. Maaari ka pa ring mag-browse ng mga anunsyo, subaybayan ang iyong mga kasalukuyang kahilingan, at mag-file ng mga reklamo.',
  'Your account is verified!': 'Beripikado na ang iyong account!',
  'You can now access all citizen portal features.':
    'Maaari mo nang magamit ang lahat ng feature ng citizen portal.',
  'Under Manual Review': 'Nasa Manual na Review',
  'Your verification is being reviewed by an administrator. You will be notified once it\'s approved.':
    'Sinusuri ng administrator ang iyong beripikasyon. Aabisuhan ka kapag naaprubahan na ito.',
  'Verification Rejected': 'Tinanggihan ang Beripikasyon',
  'Your ID submission was rejected. You can upload a clearer image to try again, or request a manual review by an administrator.':
    'Tinanggihan ang iyong pagsusumite ng ID. Maaari kang mag-upload ng mas malinaw na larawan para subukang muli, o humingi ng manual na review mula sa administrator.',
  'Reason from the reviewer:': 'Dahilan mula sa reviewer:',
  'Reviewer note:': 'Tala ng reviewer:',
  'Message for the reviewer (optional)': 'Mensahe para sa reviewer (opsyonal)',
  'Explain why your verification should be re-reviewed...':
    'Ipaliwanag kung bakit dapat suriing muli ang iyong beripikasyon...',
  'Try Again (Re-upload ID)': 'Subukang Muli (Mag-upload Muli ng ID)',
  'Submitting...': 'Isinusumite...',
  'Request Human Review': 'Humingi ng Manual na Review',
  'Your appeal was submitted. An administrator will review your verification.':
    'Naisumite ang iyong apela. Susuriin ng administrator ang iyong beripikasyon.',
  'Failed to submit appeal': 'Hindi naisumite ang apela',
  'Step 1: Select Your ID Type': 'Hakbang 1: Piliin ang Uri ng Iyong ID',
  'Choose the government-issued ID you will upload':
    'Piliin ang government ID na iyong ia-upload',
  'Select ID type': 'Piliin ang uri ng ID',
  'PhilSys (National ID)': 'PhilSys (National ID)',
  'Driver\'s License': 'Lisensya sa Pagmamaneho',
  'Voter\'s ID': 'Voter\'s ID',
  'Passport': 'Pasaporte',
  'SSS ID': 'SSS ID',
  'TIN ID': 'TIN ID',
  'Step 2: Upload Your ID': 'Hakbang 2: I-upload ang Iyong ID',
  'Upload a clear, well-lit photo of your {idType}. Supported formats: JPG, PNG, WEBP (max 5MB).':
    'Mag-upload ng malinaw at maliwanag na larawan ng iyong {idType}. Mga sinusuportahang format: JPG, PNG, WEBP (max 5MB).',
  'ID': 'ID',
  'Click to upload or drag and drop your ID image':
    'I-click para mag-upload o i-drag at i-drop ang larawan ng iyong ID',
  'ID preview': 'Preview ng ID',
  'Uploading...': 'Nag-a-upload...',
  'Processing ID (OCR)...': 'Pinoproseso ang ID (OCR)...',
  'Verify My ID': 'I-verify ang Aking ID',
  'Verification Results': 'Mga Resulta ng Beripikasyon',
  'System extracted the following fields from your ID and compared them with your account data.':
    'Kinuha ng sistema ang mga sumusunod na field mula sa iyong ID at inihambing ang mga ito sa data ng iyong account.',
  'N/A': 'Wala',
  'ID vs. account match': 'Pagtutugma ng ID laban sa account',
  'Match Score': 'Marka ng Pagtutugma',
  'Compared against your account details{fields}. No pre-registered barangay record was found for you.':
    'Inihambing sa mga detalye ng iyong account{fields}. Walang nahanap na pre-registered na record ng barangay para sa iyo.',
  'Result': 'Resulta',
  'Auto-verified': 'Awtomatikong na-verify',
  'ID verified': 'Na-verify ang ID',
  'Needs manual review': 'Kailangan ng manual na review',
  'No match': 'Walang tugma',
  'Your verification requires manual review. An administrator will check your ID and approve it within 24-48 hours.':
    'Kailangan ng manual na review ang iyong beripikasyon. Susuriin ng administrator ang iyong ID at aaprubahan ito sa loob ng 24-48 oras.',
  'Upload failed': 'Nabigo ang pag-upload',
  'You must be signed in to verify your ID. Please sign in again.':
    'Kailangan mong naka-sign in para ma-verify ang iyong ID. Mag-sign in muli.',
  'Your account is missing your name or email, so we cannot verify your ID. Please complete your profile first.':
    'Kulang ang iyong account ng pangalan o email, kaya hindi namin ma-verify ang iyong ID. Pakikumpleto muna ang iyong profile.',
  'ID processing timed out. Please try again.': 'Nag-timeout ang pagproseso ng ID. Pakisubukang muli.',
  'OCR processing failed': 'Nabigo ang pagproseso ng OCR',
  'Failed to check processing status': 'Hindi ma-check ang katayuan ng pagproseso',
  'Your ID has been verified automatically!': 'Awtomatikong na-verify ang iyong ID!',
  'Your ID has been verified! You now have full access.':
    'Na-verify ang iyong ID! Mayroon ka nang buong access.',
  'Your ID requires manual review. An admin will review it shortly.':
    'Kailangan ng manual na review ang iyong ID. Susuriin ito ng admin sa lalong madaling panahon.',
  'The photo is blurry, dark, or unreadable. Please retake it in good lighting.':
    'Malabo, madilim, o hindi mabasa ang larawan. Pakiulit ang pagkuha sa maayos na ilaw.',
  'The name on your ID does not match your account. Update your profile or contact the barangay office.':
    'Hindi tugma sa iyong account ang pangalan sa iyong ID. I-update ang iyong profile o makipag-ugnayan sa tanggapan ng barangay.',
  'The ID you uploaded is expired or no longer valid. Please upload a current one.':
    'Expired o hindi na wasto ang ID na iyong in-upload. Mag-upload ng kasalukuyan.',
  'This ID type is not accepted. Please upload a PhilSys ID, driver\u2019s license, passport, or UMID.':
    'Hindi tinatanggap ang ganitong uri ng ID. Mag-upload ng PhilSys ID, lisensya sa pagmamaneho, pasaporte, o UMID.',
  'Some details on your ID do not match our records. Please contact the barangay office.':
    'Hindi tugma sa aming mga tala ang ilang detalye sa iyong ID. Makipag-ugnayan sa tanggapan ng barangay.',
  'The document could not be validated. Please visit the barangay office with your original ID.':
    'Hindi ma-validate ang dokumento. Pumunta sa tanggapan ng barangay dala ang iyong orihinal na ID.',
  'Required details on your ID are cut off or unreadable. Please upload the full ID face.':
    'Putol o hindi mabasa ang mga kinakailangang detalye sa iyong ID. Mag-upload ng buong harap ng ID.',
  'Could not load your verification status. Please refresh the page.':
    'Hindi ma-load ang katayuan ng iyong beripikasyon. Paki-refresh ang pahina.',
  'Please upload a valid image file (JPG, PNG, WEBP)':
    'Mag-upload ng wastong image file (JPG, PNG, WEBP)',
  'Please select an ID document first': 'Pumili muna ng dokumento ng ID',
  'Upload timed out. Please try again.': 'Nag-timeout ang pag-upload. Pakisubukang muli.',

  // Request form dialog
  'Fill out the form below. Your request will be saved as pending and routed for review.':
    'Punan ang form sa ibaba. Ilalagay ang iyong kahilingan bilang nakabinbin at ipapasa para sa review.',
  'Some fields are auto-filled from your profile.':
    'Ang ilang field ay awtomatikong napupunan mula sa iyong profile.',
  'File on behalf of': 'Mag-file para sa',
  'Choose who this request is for': 'Piliin kung para kanino ang kahilingang ito',
  'Myself': 'Ako mismo',
  '(authorized)': '(awtorisado)',
  'You may file for residents who granted you proxy authorization. Manage this under Proxy Filing.':
    'Maaari kang mag-file para sa mga residenteng nagbigay sa iyo ng awtorisasyon. I-manage ito sa ilalim ng Proxy Filing.',
  'Please complete the required fields first: {fields}.':
    'Punan muna ang mga kinakailangang field: {fields}.',
  'Please sign in to submit a request.': 'Mag-sign in para makapagsumite ng kahilingan.',
  'Your resident profile is incomplete. Please finish registration first.':
    'Hindi pa kumpleto ang iyong resident profile. Tapusin muna ang pagrehistro.',
  'The authorization for that resident is no longer active. Please refresh and try again.':
    'Hindi na aktibo ang awtorisasyon para sa residenteng iyon. Paki-refresh at subukang muli.',
  'Please enter a whole number of pages (1 or more) so the fee can be computed.':
    'Maglagay ng buong bilang ng mga pahina (1 o higit pa) para makalkula ang bayad.',
  'Please enter the number of pages so the total fee can be computed.':
    'Maglagay ng bilang ng mga pahina para makalkula ang kabuuang bayad.',
  'Failed to file the request on behalf of the resident.':
    'Hindi na-file ang kahilingan para sa residente.',
  'has been submitted on behalf of {name} and is now pending review.':
    'ay naisumite para sa {name} at kasalukuyang naghihintay ng review.',
  'has been submitted successfully and is now pending review.':
    'ay matagumpay na naisumite at kasalukuyang naghihintay ng review.',
  ' Note: your payment details were saved with the request, but the payment ledger entry could not be recorded.':
    ' Paalala: naitago ang mga detalye ng iyong bayad kasama ang kahilingan, ngunit hindi na-record ang ledger entry ng bayad.',
  'Failed to submit request.': 'Hindi naisumite ang kahilingan.',
  'Payment': 'Bayad',
  'Payment Method': 'Paraan ng Bayad',
  'Select payment method': 'Piliin ang paraan ng bayad',
  'Number of Pages': 'Bilang ng mga Pahina',
  'e.g. 5 ({amount} per page)': 'hal. 5 ({amount} kada pahina)',
  'e.g. 5': 'hal. 5',
  'Enter the GCash/Maya reference number': 'Ilagay ang reference number ng GCash/Maya',
  'Amount due': 'Kabuuang dapat bayaran',
  'Enter the number of pages': 'Ilagay ang bilang ng mga pahina',
  'To be assessed at the barangay office': 'Susuriin sa tanggapan ng barangay',
  'This service is free of charge - no payment is required.':
    'Libre ang serbisyong ito - walang bayad na kailangan.',
  'No online payments: counter payments are settled at the barangay office, while GCash/Maya payments are verified by barangay staff before being marked as paid.':
    'Walang online na bayad: ang mga bayad sa counter ay tinutugunan sa tanggapan ng barangay, samantalang ang mga bayad sa GCash/Maya ay bine-verify ng mga kawani ng barangay bago ito markahang bayad.',
  'Submit Request': 'Isa-sumite ang Kahilingan',
  'Request Submitted': 'Naisumite ang Kahilingan',
  'View My Requests': 'Tingnan ang Aking mga Kahilingan',
  'Close': 'Isara',
  'Please select a payment method.': 'Pumili ng paraan ng bayad.',
  'Please enter a valid payment amount.': 'Maglagay ng wastong halaga ng bayad.',
  'Please enter the amount to pay.': 'Maglagay ng halagang babayaran.',
  'The fee for this service starts at {amount}.':
    'Nagsisimula sa {amount} ang bayad para sa serbisyong ito.',
  'The fee for this service must not exceed {amount}.':
    'Hindi dapat lumampas sa {amount} ang bayad para sa serbisyong ito.',
  'Please enter the amount you are paying.': 'Maglagay ng halagang iyong binabayaran.',
  'Please provide the {method} reference/transaction number.':
    'Magbigay ng reference/transaction number ng {method}.',
  'Select {field}': 'Piliin ang {field}',
  'Service:': 'Serbisyo:',
  'Computed Amount': 'Kinuwentang Halaga',
  'Amount to Pay': 'Halagang Babayaran',
  'Reference / Transaction Number': 'Reference / Transaction Number',
  'Request ID:': 'ID ng Kahilingan:',
  'Charter fee:': 'Bayad ayon sa Charter:',
  'Cash at Barangay Counter': 'Cash sa Counter ng Barangay',
  'To Pay at Counter': 'Babayaran sa Counter',
  'Awaiting Verification': 'Naghihintay ng Beripikasyon',
  'Free of Charge': 'Libre',

  // Service detail dialog
  'For emergencies, call first — response begins immediately.':
    'Sa mga emergency, tumawag muna — agad nagsisimula ang pagtugon.',
  'BBFRU Hotline: 0946-214-2438 · BPAT Hotline: 0938-949-5840 · National Emergency: 911':
    'Hotline ng BBFRU: 0946-214-2438 · Hotline ng BPAT: 0938-949-5840 · Pambansang Emergency: 911',
  'Use the online request only for follow-up or documentation after contacting the hotline.':
    'Gamitin ang online na kahilingan para lamang sa follow-up o dokumentasyon pagkatapos makontak ang hotline.',
  'Office': 'Opisina',
  'Classification': 'Klasipikasyon',
  'Highly Technical': 'Napakateknikal',
  'Simple': 'Simple',
  'Type of Transaction': 'Uri ng Transaksyon',
  'Who May Avail': 'Sino ang Maaaring Mag-avail',
  'Responsible Personnel': 'Responsableng Kawani',
  'Citizen\'s Charter Section': 'Seksyon ng Citizen\u2019s Charter',
  'Fees to be Paid': 'Mga Bayaring Babayaran',
  'Processing Time': 'Oras ng Pagproseso',
  'Checklist of Requirements': 'Checklist ng mga Kinakailangan',
  'Loading requirements…': 'Naglo-load ang mga kinakailangan…',
  '(optional)': '(opsyonal)',
  'Where to secure these requirements:': 'Saan makukuha ang mga kinakailangang ito:',
  'Official Process (from the Citizen\u2019s Charter)':
    'Opisyal na Proseso (mula sa Citizen\u2019s Charter)',
  'These are the barangay\u2019s official process steps. Submitting a request online is a system convenience — the office still follows the process below.':
    'Ito ang opisyal na mga hakbang ng proseso ng barangay. Ang pagsusumite ng kahilingan online ay kaginhawaan lang ng sistema — susunod pa rin ang tanggapan sa proseso sa ibaba.',
  'You': 'Ikaw',
  'Barangay': 'Barangay',
  'File a Request (Follow-up / Documentation)':
    'Mag-file ng Kahilingan (Follow-up / Dokumentasyon)',
  'Request This Service': 'Humingi ng Serbisyong Ito',
  'Information not specified in the Citizen\u2019s Charter.':
    'Walang nakasaad na impormasyon sa Citizen\u2019s Charter.',
  'Free': 'Libre',
  'Document': 'Dokumento',
  'Appointment': 'Appointment',
  'Health Service': 'Serbisyong Pangkalusugan',
  'Emergency': 'Emergency',
  'Justice': 'Katarungan',
  'Program': 'Programa',

  // Server-side notification texts (SMS locale awareness)
  'Document is being prepared for pickup': 'Inihahanda ang dokumento para sa pickup',
  'Your document is ready for pickup': 'Handa na para kunin ang iyong dokumento',
  'Document claimed': 'Nakuha na ang dokumento',
  'Identity verification approved': 'Aprubado ang beripikasyon ng pagkakakilanlan',
  'Identity verification rejected': 'Tinanggihan ang beripikasyon ng pagkakakilanlan',
  'Proxy authorization granted': 'Ginawaran ka ng awtorisasyon bilang proxy',
  'You can now file for another resident': 'Maaari ka nang mag-file para sa ibang residente',
  'Proxy authorization revoked': 'Binawi ang awtorisasyon ng proxy',
  'A request was filed on your behalf': 'May naisumiteng kahilingan para sa iyo',
  'Please visit the barangay hall with your claim code.':
    'Pumunta sa barangay hall kasama ang iyong claim code.',
  'You will receive a text message when it is ready.':
    'Magte-text kami kapag handa na ito.',
  'Claim code:': 'Claim code:',
  'Your identity has been verified. You now have full access to the portal.':
    'Na-verify na ang iyong pagkakakilanlan. Buong access na ang iyong account sa portal.',
  'Your verification was rejected. Please check the portal for the reason and re-upload a clearer ID.':
    'Tinanggihan ang iyong beripikasyon. Tingnan ang portal para sa dahilan at mag-upload muli ng mas malinaw na ID.',
}

/**
 * Server-side translation for SMS/notification texts.
 *
 * The browser persists the locale in localStorage + cookie, but server code
 * cannot read localStorage. SMS-eligible notifications are instead translated
 * using the resident's stored locale preference (`residents.locale`,
 * migration 45) — or Tagalog when the event is inherently Tagalog-facing.
 * Missing keys fall back to the English text, same as the client dictionary.
 */
export function tServer(key: string, locale: Locale): string {
  return locale === 'en' ? key : (dictionary[key] ?? key)
}

/** Normalize a raw locale value (DB column, cookie, form input) to a Locale. */
export function normalizeLocale(value: unknown): Locale {
  return value === 'tl' ? 'tl' : 'en'
}

export function getLocale(): Locale {
  // Prefer localStorage (instant, already the source of truth for the hook),
  // falling back to the cookie so SSR-rendered content agrees with the client.
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY)
    if (stored === 'tl' || stored === 'en') return stored
    return getLocaleFromCookie()
  } catch {
    return getLocaleFromCookie()
  }
}

export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
  persistLocaleCookie(locale)
}

/**
 * Translate an English key into the active locale.
 *
 * Supports `{name}`-style interpolation:
 *   t('Welcome back, {name}', locale, { name: 'Juan' })
 *
 * Missing keys and missing params degrade gracefully to English text.
 */
export function t(
  key: string,
  locale: Locale,
  params?: Record<string, string | number>,
): string {
  let text = locale === 'en' ? key : (dictionary[key] ?? key)
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

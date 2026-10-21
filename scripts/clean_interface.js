import fs from 'fs';

function cleanHtmlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping non-existent file: ${filePath}`);
    return;
  }

  let html = fs.readFileSync(filePath, 'utf8');
  const originalLength = html.length;

  // 1. Program Selection Hero Header & Badges
  html = html.replace(
    /<div style="display:inline-flex; align-items:center; gap:6px; background:rgba\(255,255,255,0\.18\); backdrop-filter:blur\(6px\); padding:4px 12px; border-radius:20px; font-size:12px; font-weight:800; letter-spacing:0\.04em; text-transform:uppercase; margin-bottom:12px; border:1px solid rgba\(255,255,255,0\.3\);">[\s\S]*?✨ एकात्मिक डिजिटल आरोग्य पोर्टल \(Unified PHC Portal\)[\s\S]*?<\/div>/g,
    ''
  );

  html = html.replace(
    /<div style="background:rgba\(0,0,0,0\.22\); border:1px solid rgba\(255,255,255,0\.2\); border-radius:14px; padding:14px 18px; text-align:right;">[\s\S]*?४ स्वतंत्र आरोग्य मॉड्यूल्स[\s\S]*?<\/div>/g,
    ''
  );

  html = html.replace(
    /<p style="margin:0; font-size:14px; line-height:1\.6; opacity:0\.95;">[\s\S]*?प्राथमिक आरोग्य केंद्र भादा अंतर्गत राबविल्या जाणाऱ्या विविध राष्ट्रीय आरोग्य नियंत्रण कार्यक्रमांचे डिजिटल डॅशबोर्ड[\s\S]*?<\/p>/g,
    ''
  );

  // Bottom Modular Architecture Badge
  html = html.replace(
    /<!-- Bottom System Architecture Badge & Footer -->[\s\S]*?<div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px 22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 2px 8px rgba\(0,0,0,0\.04\);">[\s\S]*?प्रत्येक कार्यक्रम स्वतंत्र डेटाबेस, नेव्हिगेशन, फॉर्म्स व अहवाल व्यवस्थापनासह वेगळा कार्यरत राहील\.[\s\S]*?<\/div>[\s\S]*?<\/div>/g,
    '<div style="text-align:center; padding:12px; font-size:12px; color:#64748b; font-weight:600;">&copy; २०२६ प्राथमिक आरोग्य केंद्र, भादा | सर्व हक्क सुरक्षित.</div>'
  );

  // 2. Program Cards - Remove lengthy descriptions
  html = html.replace(
    /<p style="margin:0 0 12px 0; font-size:13px; color:#475569; line-height:1\.55;">[\s\S]*?हिवताप \(Malaria\), डेंगी \(Dengue\), चिकनगुनिया व हत्तीरोग नियंत्रण[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /<p style="margin:0 0 12px 0; font-size:13px; color:#475569; line-height:1\.55;">[\s\S]*?कॉलरा \(Cholera\), काविळ\/हिपॅटायटिस \(Hepatitis\), अतिसार\/गॅस्ट्रो \(Diarrhoea\)[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /<p style="margin:0 0 12px 0; font-size:13px; color:#475569; line-height:1\.55;">[\s\S]*?क्षयरोग रुग्ण शोध व नोंदणी \(TB Notification\)[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /<p style="margin:0 0 12px 0; font-size:13px; color:#475569; line-height:1\.55;">[\s\S]*?कुष्ठरोग शोध मोहीम \(LCDC Surveillance\), संशयित रुग्ण तपासणी[\s\S]*?<\/p>/g,
    ''
  );

  // 3. NWBDCP Pane 1 (Water Sources Register)
  html = html.replace(
    /गावनिहाय जलस्त्रोत नोंदवही \(Village-wise Water Source Register\)/g,
    'जलस्त्रोत नोंदवही'
  );
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:13px; color:#475569;">[\s\S]*?प्रा\.आ\.के\. भादा अंतर्गत येणाऱ्या ३७ गावांमधील सर्व शासकीय व खाजगी पिण्याच्या पाण्याच्या स्त्रोतांची अधिकृत नोंद[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:12px; color:#64748b;">\s*\* ज्या जलस्त्रोतांची नमुना हिस्ट्री आहे ते डिलीट न होता Inactive केले जातात\.\s*<\/div>/g,
    ''
  );
  html = html.replace(
    /<span>➕ नवीन जलस्त्रोत नोंदवा \(Add Source\)<\/span>/g,
    '<span>➕ नवीन जलस्त्रोत</span>'
  );

  // 4. NWBDCP Pane 2 (Sample Dispatch)
  html = html.replace(
    /दिनांकनिहाय पाणी नमुना पाठवणी \(Date-wise Multi-Source Dispatch\)/g,
    'पाणी नमुना पाठवणी'
  );
  html = html.replace(
    /<p style="margin:0 0 16px 0; font-size:13\.5px; color:#334155; line-height:1\.5;">[\s\S]*?प्रयोगशाळेत रासायनिक व जैविक तपासणीसाठी पाठवल्या जाणाऱ्या पाण्याच्या नमुन्यांची नोंद करा[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:12\.5px; color:#64748b; font-weight:600;">\s*\* नमुने पाठवल्यानंतर प्रत्येक नमुन्याला `NWBDCP-YYYYMMDD-XXXX` असा युनिक नमुना आयडी दिला जाईल\.\s*<\/div>/g,
    ''
  );
  html = html.replace(
    /🚀 निवडलेले पाणी नमुने प्रयोगशाळेत पाठवा \(Dispatch Samples\)/g,
    '🚀 नमुने पाठवा'
  );

  // 5. NWBDCP Pane 3 (Dispatch Register)
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:13px; color:#475569;">[\s\S]*?प्रयोगशाळेत पाठवलेल्या सर्व पाण्याच्या नमुन्यांची जावक नोंदणी, बाटल्यांसाठी स्टिकर्स लेबल प्रिंट व अधिकृत शासकीय जावक पत्र तयार करा\.[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /📄 शासकीय पाठवणी पत्र तयार करा \(Gov Letter\)/g,
    '📄 शासकीय पाठवणी पत्र'
  );

  // 6. NWBDCP Pane 4 (Lab Results)
  html = html.replace(
    /✏️ प्रयोगशाळा अहवाल निकाल अपडेट \(Lab Results Entry\)/g,
    'प्रयोगशाळा अहवाल निकाल'
  );
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:13px; color:#475569;">[\s\S]*?प्रयोगशाळेकडून प्राप्त झालेल्या रासायनिक व जैविक तपासणी निकालांची नोंद करा \(`पिण्यास योग्य` किंवा `पिण्यास अयोग्य`\)\.[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:12px; color:#64748b;">\s*\* 'पिण्यास अयोग्य' नमुन्यांसाठी थेट \*\*पुनर्तपासणी \(Re-Test\)\*\* व अहवाल \*\*प्रत पहा\/बदला\*\* सुविधा उपलब्ध\.\s*<\/div>/g,
    ''
  );

  // 7. NWBDCP Pane 5 (Retests)
  html = html.replace(
    /🔄 दूषित पाणी नमुने पुनर्तपासणी व तातडीची ॲक्शन नोंदवही \(Re-Test & Action Log\)/g,
    'दूषित नमुने पुनर्तपासणी नोंदवही'
  );
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:13px; color:#475569;">[\s\S]*?'पिण्यास अयोग्य' ठरलेल्या नमुन्यांवर टीसीएल सुपर क्लोरीनेशन उपाययोजना[\s\S]*?<\/p>/g,
    ''
  );

  // 8. NWBDCP Pane 6 (Reports)
  html = html.replace(
    /📑 NWBDCP पाणी गुणवत्ता अधिकृत अहवाल प्रणाली/g,
    'पाणी गुणवत्ता अहवाल'
  );
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:13px; color:#475569;">[\s\S]*?शासकीय व जिल्हा पातळीवर सादर करण्यासाठी दैनिक, मासिक, प्रगतीपथावरील व उपकेंद्रनिहाय अहवाल ऑटो-कॅल्क्युलेट करा\.[\s\S]*?<\/p>/g,
    ''
  );

  // 9. NWBDCP Pane 7 (Historical Import)
  html = html.replace(
    /जुने पाणी नमुने डेटा लोड करा \(Historical Water Samples Import\)/g,
    'डेटा आयात'
  );
  html = html.replace(
    /<p style="margin:0 0 16px 0; font-size:13\.5px; color:#334155; line-height:1\.5;">[\s\S]*?गुगल शीट किंवा जुन्या एक्सल \/ CSV फाईलमधील पाणी नमुन्यांच्या ऐतिहासिक नोंदी नियंत्रित पद्धतीने सिस्टीममध्ये इम्पोर्ट करा[\s\S]*?<\/p>/g,
    ''
  );

  // 10. NVBDCP Monthly Report Dashboard & Workflow Guide
  html = html.replace(
    /मासिक अहवाल डॅशबोर्ड \(NVBDCP Monthly Report Dashboard\)/g,
    'मासिक अहवाल डॅशबोर्ड'
  );
  html = html.replace(
    /<p style="margin:6px 0 0 0; font-size:13px; color:#2d3748; line-height:1\.5;">[\s\S]*?<b>नवीन बाह्यरुग्ण \(OPD\)<\/b>, <b>तापाचे रुग्ण<\/b>, <b>उपचारीत रुग्ण<\/b> व <b>क्लोरोक्वीन गोळ्या खर्च<\/b>[\s\S]*?<\/p>/g,
    ''
  );

  // Remove the entire 3-step workflow guide
  html = html.replace(
    /<!-- 3-Step Data Matching Guide Card -->[\s\S]*?<div style="background:#f7fafc; border:1px solid #cbd5e0; border-left:4px solid #3182ce; border-radius:10px; padding:12px 16px; margin-bottom:18px;">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g,
    ''
  );

  // Remove duplicate workflow guide if present
  html = html.replace(
    /<div id="dataWorkflowGuideContent"[\s\S]*?<\/div>\s*<\/div>/g,
    ''
  );

  // Remove explanation paragraphs in Monthly indicators
  html = html.replace(
    /<p id="monthlySubpaneDesc" style="margin:4px 0 0 0; font-size:13px; color:#2d3748;">[\s\S]*?या पानावर फक्त <b>'नवीन बाह्यरुग्ण \(New OPD\)'<\/b> ची मासिक संख्या प्रविष्ट करा[\s\S]*?<\/p>/g,
    ''
  );

  html = html.replace(
    /<div style="font-size:12\.5px; color:#4a5568; margin-top:2px;">मासिक अहवालासाठी खालील \*\*'नवीन बाह्यरुग्ण \(New OPD\)'\*\* ची मासिक संख्या प्रविष्ट करा\.<\/div>/g,
    ''
  );

  html = html.replace(
    /<!-- Notice Banner for OPD active field -->[\s\S]*?<div style="background:#fffaf0; border:1px solid #fbd38d; border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:12\.5px; color:#c05621; font-weight:600; display:flex; align-items:center; gap:8px;">[\s\S]*?<\/div>/g,
    ''
  );

  // Home Visit standalone explanation
  html = html.replace(
    /<div style="font-size:13px; color:#2d3748; margin-top:6px;">[\s\S]*?या स्वतंत्र फॉर्ममध्ये फक्त आरोग्य सेवक \(MPW\) व आरोग्य सेविका \(ANM\) यांच्या पहिल्या[\s\S]*?<\/div>/g,
    ''
  );

  // 11. Reports & Notices Tab
  html = html.replace(
    /उपलब्ध अहवाल व नोटीस केंद्र \(Reports & Notices Center\)/g,
    'अहवाल व नोटीस'
  );
  html = html.replace(
    /<div style="font-size:12\.5px; color:#115e59; margin-top:3px; font-weight:600;">[\s\S]*?दैनिक तपासणी पत्रे, मासिक पडताळणी अहवाल, कर्मचारी नोंदवही[\s\S]*?<\/div>/g,
    ''
  );
  // Remove all card-desc paragraphs in reports
  html = html.replace(/<p class="card-desc">[\s\S]*?<\/p>/g, '');

  html = html.replace(
    /<div style="color:#4a5568; font-size:12\.5px; font-weight:600;">\s*अहवालातील डेटा जुळणी व त्रुटी तपासण्यासाठी खालील 'Validator' बटणावर क्लिक करा:\s*<\/div>/g,
    ''
  );

  // 12. Dengue & Chikungunya Tab
  html = html.replace(
    /<div style="font-size:12px; color:var\(--text-muted\); font-weight:500;">\s*NIV Pune Case History Sheet आणि GMC लातूर प्रयोगशाळेसाठी आवश्यक सर्व तपशील भरा\.\s*<\/div>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:12\.5px; color:var\(--text-muted\); font-weight:500;">\s*GMC लातूर प्रयोगशाळेकडून पाठवलेल्या नमुन्यांच्या संपूर्ण तारखेचा एकत्रित अहवाल[\s\S]*?<\/div>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:13px; color:#2b6cb0; font-weight:600;">\s*ℹ️ <b>GMC लातूर पद्धत:<\/b>[\s\S]*?<\/div>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:12\.5px; color:var\(--text-muted\); font-weight:500;">\s*मागील महिन्यांमधील किंवा वर्षांमधील Excel \/ CSV फाईलमधील जुना डेंगी व चिकनगुनिया डेटा थेट आयात करा[\s\S]*?<\/div>/g,
    ''
  );

  // 13. Master Data Management Tab
  html = html.replace(
    /🏛️ मास्टर डेटा व्यवस्थापन \(Master Data Management\)/g,
    'मास्टर डेटा व्यवस्थापन'
  );
  html = html.replace(
    /<p style="margin:0; color:var\(--text-muted\); font-size:13px;">\s*उपकेंद्र, कायम BS Codes, आरोग्य कर्मचारी \(ANM \/ MPW \/ ASHA\) संलग्नता, सेवा समाप्ती व बदली सुविधा\.\s*<\/p>/g,
    ''
  );
  html = html.replace(
    /<div>📌 <b>टीप:<\/b> प्रत्येक गावाची लोकसंख्या \(Population\), घरांची संख्या \(No\. of Houses\) व संबंधित आशा स्वयंसेविका यांची नोंद\.<\/div>/g,
    ''
  );

  // 14. Data Upload Tab
  html = html.replace(
    /डेटा अपलोड व दिनांक प्रमाणीकरण केंद्र \(CSV Data Upload & State Store\)/g,
    'डेटा अपलोड'
  );
  html = html.replace(
    /<p style="margin:0; color:#4a5568; font-size:13\.5px; line-height:1\.5;">[\s\S]*?CSV फाईल किंवा गुगल शीटमधील डेटा थेट अपलोड करा\.[\s\S]*?<\/p>/g,
    ''
  );

  // 15. Modals - remove explanatory paragraphs
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:12\.5px; color:#718096;">\s*कर्मचाऱ्याची दुसऱ्या गावात किंवा उपकेंद्रात बदली करा व सर्व संबंधित लिंक्ड रेकॉर्ड्स अद्ययावत करा\.\s*<\/p>/g,
    ''
  );
  html = html.replace(
    /<small style="color:#4a5568; display:block; margin-top:6px; font-size:11\.5px;">\s*💡 <i>टीप: कोणत्याही गावावर क्लिक करताच त्या गावाचे उपकेंद्र आपोआप निश्चित केले जाईल\.<\/i>\s*<\/small>/g,
    ''
  );
  html = html.replace(
    /<!-- 3\. Linked Records Auto-Sync Preview -->[\s\S]*?<div style="background:#fffaf0; border:1px solid #feebc8; border-radius:8px; padding:12px; margin-bottom:16px; font-size:12px; color:#744210;">[\s\S]*?<\/div>\s*<\/div>/g,
    ''
  );
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:12px; color:#718096;">\s*कर्मचाऱ्याची BS कोडवरील सेवा समाप्त करून BS कोड नवीन पदभारासाठी रिक्त करा\.\s*<\/p>/g,
    ''
  );
  html = html.replace(
    /<p style="margin:4px 0 0 0; font-size:12px; color:#718096;">\s*<b>नियम:<\/b> एका BS कोडला एका वेळी एकच कर्मचारी attach होऊ शकतो\.\s*<\/p>/g,
    ''
  );
  html = html.replace(
    /<p style="margin:2px 0 0 0; font-size:12\.5px; color:#9c4221;">\s*शासकीय वैद्यकीय महाविद्यालय \(GMC\) \/ प्रयोगशाळेकडून प्राप्त अहवाल[\s\S]*?<\/p>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:12px; color:#2b6cb0; font-weight:600; display:flex; align-items:center; gap:6px;">\s*<span>💡<\/span> डेंगी व चिकनगुनिया अहवाल वेगवेगळ्या वेळी उपलब्ध झाल्यास[\s\S]*?<\/div>/g,
    ''
  );
  html = html.replace(
    /<div style="font-size:13px; font-weight:700; color:#0369a1;">\s*A4 कागदावर स्टिकर्स लेबल प्रिंट करण्यासाठी तयार\.\s*<\/div>/g,
    ''
  );

  // 16. Standard Headings for Forms and Fields across the whole system
  const standardHeadings = [
    // Subtabs
    ['🚰 जलस्त्रोत नोंदवही (Water Sources)', 'जलस्त्रोत नोंदवही'],
    ['🧪 नमुना पाठवणी (Sample Dispatch)', 'नमुना पाठवणी'],
    ['📋 नमुना रजिस्टर व स्टिकर्स (Dispatch Register)', 'नमुना रजिस्टर'],
    ['✏️ अहवाल निकाल अपडेट (Lab Results)', 'अहवाल निकाल'],
    ['🔄 पुनर्तपासणी रजिस्टर (Re-Test)', 'पुनर्तपासणी रजिस्टर'],
    ['📑 पाणी अहवाल (NWBDCP Reports)', 'पाणी अहवाल'],
    ['📥 जुने नमुने लोड करा (Historical Import)', 'डेटा आयात'],
    ['📊 रक्त नमुने विश्लेषण व आलेख (Blood Smear Overview & Graphs)', 'डॅशबोर्ड सारांश'],
    ['📑 मासिक अहवाल डॅशबोर्ड (NVBDCP Indicators & Template Report)', 'मासिक अहवाल डॅशबोर्ड'],
    ['📈 गावनिहाय कर्मचारी विश्लेषण (Recharts Analytics)', 'गावनिहाय कर्मचारी विश्लेषण'],
    ['आरोग्य कार्यक्रम निवड (Select Health Program)', 'आरोग्य कार्यक्रम'],
    ['प्रकल्प उघडा (Open NVBDCP)', 'प्रकल्प उघडा'],
    ['मॉड्यूल पहा (Open NWBDCP)', 'मॉड्यूल उघडा'],
    ['मॉड्यूल पहा (Open NTEP)', 'मॉड्यूल उघडा'],
    ['मॉड्यूल पहा (Open NLEP)', 'मॉड्यूल उघडा'],

    // NWBDCP Form & Filter Labels
    ['उपकेंद्र (Subcenter):', 'उपकेंद्र:'],
    ['गाव (Village):', 'गाव:'],
    ['स्त्रोत प्रकार (Source Type):', 'स्त्रोत प्रकार:'],
    ['मालकी (Ownership):', 'मालकी:'],
    ['स्थिती (Status):', 'स्थिती:'],
    ['शोधा (Search):', 'शोधा:'],
    ['स्त्रोत आयडी (Source ID)', 'स्त्रोत आयडी'],
    ['जलस्त्रोताचे नाव (Source Name)', 'जलस्त्रोताचे नाव'],
    ['जलस्त्रोताचे नाव (Water Source Name):', 'जलस्त्रोताचे नाव:'],
    ['स्त्रोत प्रकार (वर्गवारी)', 'स्त्रोत प्रकार'],
    ['कृती (Actions)', 'कृती'],
    ['पाणी संकलन दिनांक (Collection Date):', 'पाणी संकलन दिनांक:'],
    ['प्रयोगशाळा पाठवणी दिनांक (Dispatch Date):', 'प्रयोगशाळा पाठवणी दिनांक:'],
    ['प्रयोगशाळेचे नाव (Laboratory Address):', 'प्रयोगशाळेचे नाव:'],
    ['1. उपकेंद्रे निवडा (Select Subcenters):', 'उपकेंद्रे:'],
    ['2. गावे निवडा (Select Villages):', 'गावे:'],
    ['3. नमुन्यांसाठी जलस्त्रोत निवडा (Select Sources for Dispatch):', 'जलस्त्रोत निवडा:'],
    ['📅 पाठवणी दिनांक (Sending Date):', 'पाठवणी दिनांक:'],
    ['📅 पाठवणी दिनांक यादी (Select Date):', 'पाठवणी दिनांक:'],
    ['नमुना निकाल स्थिती:', 'निकाल स्थिती:'],
    ['नमुना आयडी (Sample ID)', 'नमुना आयडी'],
    ['अहवाल प्राप्ती दिनांक (Report Date)', 'अहवाल प्राप्ती दिनांक'],
    ['प्रयोगशाळा जा.क्र. (Lab Ref No):', 'प्रयोगशाळा जावक क्र.:'],
    ['तपासणी निकाल (Test Result)', 'तपासणी निकाल'],
    ['अहवाल प्रत (Report Copy)', 'अहवाल प्रत'],
    ['स्थिती (Status)', 'स्थिती'],
    ['पुनर्तपासणी आयडी (Re-Test ID)', 'पुनर्तपासणी आयडी'],
    ['केलेली उपाययोजना (Action Taken)', 'केलेली उपाययोजना'],
    ['केलेली दुरुस्ती / टीसीएल उपाययोजना (Action Taken):', 'केलेली उपाययोजना:'],
    ['पुढील प्रक्रिया व तातडीची ॲक्शन (Action & Next Step)', 'पुढील प्रक्रिया'],
    ['अहवाल प्रकार (Report Type):', 'अहवाल प्रकार:'],
    ['दिनांकापासून (From Date):', 'दिनांकापासून:'],
    ['दिनांकापर्यंत (To Date):', 'दिनांकापर्यंत:'],
    ['निकाल (Result Status):', 'निकाल:'],
    ['1. CSV / Excel डेटा पेस्ट करा किंवा फाईल निवडा:', 'CSV / Excel फाईल किंवा मजकूर:'],
    ['🔍 डेटा पडताळणी करा (Validate & Preview)', 'डेटा पडताळणी करा'],
    ['इम्पोर्ट पडताळणी निकाल (Validation Summary)', 'पडताळणी निकाल'],
    ['रद्द करा (Cancel)', 'रद्द करा'],
    ['💾 खात्री आहे, डेटा सेव्ह करा (Final Commit)', 'डेटा सेव्ह करा'],
    ['🚰 नवीन जलस्त्रोत नोंदवा (Add Water Source)', 'नवीन जलस्त्रोत'],
    ['स्त्रोत आयडी / कोड (Source ID): <span style="font-size:11px; color:#0284c7; font-weight:700;">(ऑटो-जनरेट / Auto)</span>', 'स्त्रोत आयडी:'],
    ['ठिकाण / परिसर (Landmark):', 'ठिकाण / परिसर:'],
    ['💾 जलस्त्रोत सेव्ह करा (Save Source)', 'जलस्त्रोत सेव्ह करा'],
    ['🖨️ पाणी नमुना बाटली स्टिकर प्रिंट (Print Sample Bottle Labels)', 'स्टिकर प्रिंट'],
    ['🖨️ प्रिंट करा (Print Page)', 'प्रिंट करा'],
    ['📄 अधिकृत शासकीय पाणी नमुना पाठवणी पत्र (Government Dispatch Letter)', 'शासकीय पाठवणी पत्र'],
    ['🖨️ पत्र प्रिंट काढा (Print)', 'पत्र प्रिंट करा'],
    ['🔄 दूषित नमुना पुनर्तपासणी (Initiate Re-Test)', 'दूषित नमुना पुनर्तपासणी'],
    ['🚀 पुनर्तपासणी नमुना नोंदवा (Create Re-Test)', 'पुनर्तपासणी नोंदवा'],
    ['प्रयोगशाळा जावक क्र. (Lab Ref No):', 'प्रयोगशाळा जावक क्र.:'],
    ['प्रयोगशाळा अहवाल प्रत अपलोड करा (PDF / Image):', 'प्रयोगशाळा अहवाल प्रत:'],
    ['⚡ द्वितीय पुनर्तपासणी (2nd Round Re-Test & Chlorination)', 'द्वितीय पुनर्तपासणी'],
    ['द्वितीय तातडीची सुधारणा / तीव्र क्लोरीनेशन उपाययोजना:', 'सुधारणा उपाययोजना:'],
    ['🚀 २ री पुनर्तपासणी नोंदवा (Create 2nd Re-Test)', '२ री पुनर्तपासणी नोंदवा'],

    // NVBDCP Monthly Indicators & Dashboard
    ['✏️ मासिक निर्देशक त्वरित संपादन (Quick Edit Indicators):', 'मासिक निर्देशक संपादन:'],
    ['🏥 नवीन बाह्यरुग्ण (New OPD)', 'नवीन बाह्यरुग्ण'],
    ['🌡️ तापाचे रुग्ण (Fever Cases)', 'तापाचे रुग्ण'],
    ['🩸 घेतलेले रक्त नमुणे (Blood Smears)', 'घेतलेले रक्त नमुने'],
    ['💊 उपचारीत रुग्ण (Treated Cases)', 'उपचारीत रुग्ण'],
    ['⚪ क्लोरोक्वीन गोळया खर्च (Chloroquine)', 'क्लोरोक्वीन गोळ्या खर्च'],
    ['⚪ क्लोरोक्वीन गोळया (Chloroquine)', 'क्लोरोक्वीन गोळ्या'],
    ['🚶‍♂️ आरोग्य सेवक (MPW) गृहभेटी (आदिवासी / ग्रामीण)', 'आरोग्य सेवक (MPW) गृहभेटी'],
    ['👩‍⚕️ आरोग्य सेविका (ANM) गृहभेटी (आदिवासी / ग्रामीण)', 'आरोग्य सेविका (ANM) गृहभेटी'],
    ['🚶‍♂️ आरोग्य सेवक (MPW) गृहभेटी', 'आरोग्य सेवक (MPW) गृहभेटी'],
    ['👩‍⚕️ आरोग्य सेविका (ANM) गृहभेटी', 'आरोग्य सेविका (ANM) गृहभेटी'],
    ['मासिक संख्या (Monthly OPD) *', 'मासिक संख्या *'],
    ['प्रगत संख्या (Progressive - YTD)', 'प्रगत संख्या'],
    ['प्रगत संख्या (YTD)', 'प्रगत संख्या'],
    ['मासिक संख्या (दैनिक नोंदींमधून)', 'मासिक संख्या'],
    ['१ ला पंधरवाडा (1-15)', '१ ला पंधरवडा'],
    ['२ रा पंधरवडा (16-अखेर)', '२ रा पंधरवडा'],
    ['👁️ मासिक अहवाल थेट पूर्वावलोकन (Live Template Report Preview)', 'मासिक अहवाल पूर्वावलोकन'],
    ['📋 मासिक अहवाल नोंदणी (NVBDCP Monthly Indicators)', 'मासिक अहवाल नोंदणी'],
    ['🏥 १. नवीन ओपीडी नोंदणी (New OPD Entry)', 'नवीन ओपीडी नोंदणी'],
    ['🚶‍♂️ २. स्वतंत्र गृहभेटी नोंदणी (Home Visit Entry - MPW & ANM)', 'गृहभेटी नोंदणी'],
    ['🏥 १. नवीन बाह्यरुग्ण (OPD) माहिती नोंदणी', 'नवीन बाह्यरुग्ण नोंदणी'],
    ['🚶‍♂️ स्वतंत्र गृहभेटी नोंदणी फॉर्म (Standalone Home Visit Entry Form - MPW & ANM)', 'गृहभेटी नोंदणी'],

    // Reports Tab Cards
    ['दैनिक पत्र (Daily Smear Letter)', 'दैनिक पत्र'],
    ['मासिक अहवाल (Monthly PDF)', 'मासिक अहवाल'],
    ['मासिक अहवाल डेटा नोंदणी (Template Entry)', 'मासिक अहवाल डेटा नोंदणी'],
    ['गृहभेटी डेटा एन्ट्री (Home Visits)', 'गृहभेटी डेटा एन्ट्री'],
    ['कर्मचारी नोंदवही (Staff Register)', 'कर्मचारी नोंदवही'],
    ['कारणे दाखवा नोटीस (Notice)', 'कारणे दाखवा नोटीस'],
    ['कमी कामगिरी अहवाल (Low Performance)', 'कमी कामगिरी अहवाल'],
    ['डेंगी व चिकनगुनिया (Dengue & Chik)', 'डेंगी व चिकनगुनिया'],
    ['📊 मासिक अहवाल व डेटा पडताळणी', 'मासिक अहवाल'],
    ['अहवाल डेटा पडताळणी व त्रुटी दुरुस्ती (Report Validator)', 'डेटा पडताळणी'],

    // Dengue & Chikungunya
    ['डेंगी व चिकनगुनिया संशयित सिरम नमुना नोंद फॉर्म', 'डेंगी व चिकनगुनिया नोंद फॉर्म'],
    ['✨ नवीन नोंद (New Record)', 'नवीन नोंद'],
    ['👤 १. रुग्णाची माहिती व पत्ता (Patient Details & Address)', 'रुग्ण माहिती व पत्ता'],
    ['रुग्णाचे संपूर्ण नाव (Full Name of Patient)', 'रुग्णाचे संपूर्ण नाव'],
    ['मोबाईल क्रमांक (Mobile Number)', 'मोबाईल क्रमांक'],
    ['उपकेंद्र (Subcenter)', 'उपकेंद्र'],
    ['गाव (Village)', 'गाव'],
    ['घर क्रमांक (House No)', 'घर क्रमांक'],
    ['तालुका (Taluka)', 'तालुका'],
    ['जिल्हा (District)', 'जिल्हा'],
    ['🏥 २. रुग्णालय व नोंदणी माहिती (Hospital & Demographics)', 'रुग्णालय व नोंदणी माहिती'],
    ['रुग्णालय पत्ता (Hospital Address)', 'रुग्णालय पत्ता'],
    ['रुग्ण नोंदणी क्र. (Patient Reg No)', 'रुग्ण नोंदणी क्र.'],
    ['वार्ड क्र. (Ward No) & बेड क्र. (Bed No)', 'वार्ड व बेड क्र.'],
    ['वय (Age in Years)', 'वय (वर्षे)'],
    ['लिंग (Sex)', 'लिंग'],
    ['🧪 ३. नमुना व क्लिनिकल लक्षणे (Sample & Clinical Findings)', 'नमुना व क्लिनिकल लक्षणे'],
    ['पहिले लक्षण सुरू दिनांक (Onset Date)', 'लक्षणे सुरू दिनांक'],
    ['नमुन्याचा प्रकार (Nature of Sample)', 'नमुना प्रकार'],
    ['नमुना घेतल्याचा दिनांक (Collection Date)', 'नमुना घेतल्याचा दिनांक'],
    ['क्लिनिकल लक्षणे (दिवस संख्या - Clinical Findings in Days):', 'क्लिनिकल लक्षणे (दिवस):'],
    ['१. ताप (Fever Days)', 'ताप (दिवस)'],
    ['२. डोकेदुखी (Headache)', 'डोकेदुखी'],
    ['३. अंगदुखी (Bodyache)', 'अंगदुखी'],
    ['४. सांधेदुखी (Joint Pain)', 'सांधेदुखी'],
    ['५. डोळ्यांमागे दुखणे', 'डोळ्यांमागे दुखणे'],
    ['६. अंगावर पुरळ (Rash)', 'अंगावर पुरळ'],
    ['🩸 ४. रक्तस्राव लक्षणे (Haemorrhagic Manifestation)', 'रक्तस्राव लक्षणे'],
    ['रक्तस्राव लक्षणे आहेत का? (Yes / No)', 'रक्तस्राव लक्षणे'],
    ['🩺 ५. वैद्यकीय अधिकारी माहिती (Medical Officer)', 'वैद्यकीय अधिकारी माहिती'],
    ['💾 नोंद जतन करा (Save Entry)', 'नोंद जतन करा'],
    ['🔄 फॉर्म साफ करा (Reset)', 'रीसेट करा'],
    ['दिनांकनिहाय (Batch) GMC प्रयोगशाळा एकत्रित अहवाल नोंदणी', 'दिनांकनिहाय लॅब अहवाल नोंदणी'],
    ['📋 नोंदवही पाहा (View Register)', 'नोंदवही पाहा'],
    ['१. एकत्रित प्रयोगशाळा अहवाल तपशील (Common Batch Details):', 'एकत्रित प्रयोगशाळा अहवाल तपशील:'],
    ['📅 नमुना पाठवल्याचा दिनांक निवडा (Dispatch Date)', 'नमुना पाठवणी दिनांक'],
    ['📑 GMC अहवाल संदर्भ क्र. (Report Ref No.)', 'अहवाल संदर्भ क्र.'],
    ['📅 अहवाल प्राप्त दिनांक (Received Date)', 'अहवाल प्राप्त दिनांक'],
    ['🧪 चाचणी प्रकार (Test Method)', 'चाचणी प्रकार'],
    ['२. निवडलेल्या दिनांकाचे रुग्ण व निकाल (Patient Results List)', 'रुग्ण निकाल यादी'],
    ['डेंगी व चिकनगुनिया जुना डेटा आयात केंद्र (Old Data CSV / Excel Import)', 'डेटा आयात केंद्र'],
    ['📋 नोंदवही पाहा (Register)', 'नोंदवही पाहा'],
    ['प्रयोगशाळा तपासणी अहवाल नोंदणी व अपडेट', 'प्रयोगशाळा तपासणी अहवाल'],

    // Master Data Tab
    ['🔗 BS कोड संलग्न करा (Attach)', 'BS कोड संलग्न करा'],
    ['🛑 सेवा समाप्ती (End Service)', 'सेवा समाप्ती'],
    ['🔄 कर्मचारी बदली (Transfer)', 'कर्मचारी बदली'],
    ['👥 कर्मचारी यादी व कार्यक्षेत्र (Employees & Villages)', 'कर्मचारी यादी'],
    ['🏷️ BS Codes व पदभार / सेवा समाप्ती (BS Codes & Attachment)', 'BS कोड व्यवस्थापन'],
    ['🏘️ गावे मास्टर - लोकसंख्या व घरे (Villages, Pop & Houses)', 'गावे मास्टर'],
    ['🏛️ उपकेंद्र मास्टर (Subcenters)', 'उपकेंद्र मास्टर'],
    ['🔄 बदली सुविधा व इतिहास (Transfer Facility & Log)', 'बदली इतिहास'],
    ['पदनाम (Designation)', 'पदनाम'],
    ['लागू असणारी गावे (Applied Villages)', 'लागू असणारी गावे'],
    ['गावाचे नाव (Village)', 'गावाचे नाव'],
    ['👥 लोकसंख्या (Population)', 'लोकसंख्या'],
    ['🏠 घरांची संख्या (No. of Houses)', 'घरांची संख्या'],
    ['वार्षिक उद्दिष्ट (Target)', 'वार्षिक उद्दिष्ट'],
    ['आशा स्वयंसेविका (ASHA)', 'आशा स्वयंसेविका'],
    ['आरोग्य कर्मचारी (Staff)', 'आरोग्य कर्मचारी'],

    // Modals
    ['👤 नवीन कर्मचारी जोडा (Add Employee)', 'नवीन कर्मचारी'],
    ['पद प्रवर्ग (Category) *', 'पद प्रवर्ग *'],
    ['पदनाम (Designation Label)', 'पदनाम'],
    ['लागू असणारी गावे (Applied Villages):', 'लागू असणारी गावे:'],
    ['🏘️ नवीन गाव जोडा (Add Village)', 'नवीन गाव'],
    ['लोकसंख्या (Population) *', 'लोकसंख्या *'],
    ['घरांची संख्या (No of Houses) *', 'घरांची संख्या *'],
    ['वार्षिक रक्त नमुने उद्दिष्ट (Annual Target)', 'वार्षिक उद्दिष्ट'],
    ['🏛️ उपकेंद्र तपशील (Subcenter Details)', 'उपकेंद्र तपशील'],
    ['मुख्यालय (Headquarter)', 'मुख्यालय'],
    ['🔄 कर्मचारी बदली व गाव वाटप (Employee Transfer & Village Assignment)', 'कर्मचारी बदली व गाव वाटप'],
    ['१. बदली करावयाचा कर्मचारी निवडा (Select Employee) *', 'कर्मचारी निवडा *'],
    ['२. नवीन गाव व कार्यक्षेत्र वाटप (Assign to New Village & Subcenter) *', 'नवीन गाव व कार्यक्षेत्र वाटप *'],
    ['बदलीचे कारण (Reason) *', 'बदलीचे कारण *'],
    ['आदेश क्र. व दिनांक (Order Number & Date)', 'आदेश क्र. व दिनांक'],
    ['✅ बदली व गाव वाटप आदेश लागू करा (Execute Transfer)', 'बदली आदेश लागू करा'],
    ['🛑 सेवा समाप्ती / कार्यमुक्त करणे (End Service)', 'सेवा समाप्ती'],
    ['१. कर्मचारी निवडा (Select Employee) *', 'कर्मचारी निवडा *'],
    ['२. सेवा समाप्ती / कार्यमुक्ती दिनांक (End Date) *', 'सेवा समाप्ती दिनांक *'],
    ['३. सेवा समाप्तीचे कारण (Reason) *', 'सेवा समाप्तीचे कारण *'],
    ['४. आदेश क्र. / संदर्भ (Order No. / Reference)', 'आदेश क्र. / संदर्भ'],
    ['५. शेरा / टिप्पणी (Remarks)', 'शेरा'],
    ['🛑 सेवा समाप्ती आदेश लागू करा (Execute End Service)', 'सेवा समाप्ती आदेश लागू करा'],
    ['🔗 कर्मचारी BS कोडला संलग्न करणे / पदभार देणे (Attach to BS Code)', 'BS कोड संलग्न करा'],
    ['२. उपकेंद्र निवडा (Subcenter) *', 'उपकेंद्र *'],
    ['३. कायम BS Code निवडा (Fixed Code) *', 'BS Code *'],
    ['४. पदभार प्रकार (Charge Type) *', 'पदभार प्रकार *'],
    ['५. संलग्न दिनांक (Attach Date) *', 'संलग्न दिनांक *'],
    ['६. आदेश क्रमांक / संदर्भ (Order No.)', 'आदेश क्र. / संदर्भ'],
    ['७. शेरा / टिप्पणी (Remarks)', 'शेरा'],
    ['🔗 BS कोड संलग्न करा (Execute Attach)', 'BS कोड संलग्न करा'],
    ['📜 BS Code सेवा कार्यकाळ व समाप्ती इतिहास (Tenure & End Service Log)', 'BS Code सेवा इतिहास'],
    ['🗺️ कार्यक्षेत्र गावे अद्ययावत करा (Assign Villages)', 'कार्यक्षेत्र गावे वाटप'],
    ['लागू असणारी गावे निवडा (Applied Villages):', 'लागू असणारी गावे:'],
    ['💾 गावे सेव्ह करा (Save Villages)', 'गावे सेव्ह करा'],

    // CSV Upload
    ['१. ज्या प्रकारचा डेटा अपलोड करायचा आहे तो निवडा (Select Dataset Type):', 'डेटा प्रकार निवडा:'],
    ['किंवा खाली थेट CSV मजकूर पेस्ट करा (Paste Raw CSV / Excel Data):', 'किंवा खाली थेट CSV मजकूर पेस्ट करा:'],
    ['आधीचा डेटा पूर्णपणे नवीन डेटाने बदला (Replace existing dataset)', 'आधीचा डेटा पूर्णपणे नवीन डेटाने बदला'],
    ['⚡ त्वरित पार्स व प्रमाणीकरण करा (Parse & Validate)', 'पार्स व प्रमाणीकरण करा'],
    ['डेटा व दिनांक प्रमाणीकरण पूर्वावलोकन (Parsed Records Preview)', 'डेटा पूर्वावलोकन'],
    ['💾 सर्व वैध नोंदी स्टेट व सिस्टीममध्ये सेव्ह करा (Store & Sync)', 'डेटा सेव्ह करा']
  ];

  standardHeadings.forEach(([oldH, newH]) => {
    html = html.split(oldH).join(newH);
  });

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Cleaned ${filePath}: ${originalLength} -> ${html.length} bytes (removed ${originalLength - html.length} bytes of junk/explanations).`);
}

cleanHtmlFile('index.html');
cleanHtmlFile('Form.html');

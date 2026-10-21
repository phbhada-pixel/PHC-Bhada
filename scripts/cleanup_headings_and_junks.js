import fs from 'fs';

const filePath = 'index.html';
let html = fs.readFileSync(filePath, 'utf8');

console.log('Original length:', html.length);

// 1. Clean NTEP Planned Sub-modules Roadmap & descriptions
html = html.replace(
  /📋\s*नियोजित फॉर्म्स व उप-मॉड्यूल्स\s*\(Roadmap of NTEP Features\):/g,
  'नियोजित मॉड्यूल्स'
);

html = html.replace(
  /<div style="font-weight:700; color:#4338ca; font-size:14px; margin-bottom:6px;">1\. संशयित क्षयरोग रुग्ण व थुंकी तपासणी<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#4338ca; font-size:14px;">१. संशयित रुग्ण व थुंकी तपासणी</div>'
);

html = html.replace(
  /<div style="font-weight:700; color:#4338ca; font-size:14px; margin-bottom:6px;">2\. निक्षय रुग्ण नोंदणी \(TB Notification\)<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#4338ca; font-size:14px;">२. निक्षय रुग्ण नोंदणी</div>'
);

html = html.replace(
  /<div style="font-weight:700; color:#4338ca; font-size:14px; margin-bottom:6px;">3\. उपचार कार्ड व औषध वाटप \(Treatment Cards\)<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#4338ca; font-size:14px;">३. उपचार व औषध वाटप</div>'
);

html = html.replace(
  /<div style="font-weight:700; color:#4338ca; font-size:14px; margin-bottom:6px;">4\. निक्षय पोषण योजना व संपर्क तपासणी<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#4338ca; font-size:14px;">४. निक्षय पोषण व संपर्क तपासणी</div>'
);

// 2. Clean NLEP Planned Sub-modules Roadmap & descriptions
html = html.replace(
  /NLEP राष्ट्रीय कुष्ठरोग निर्मूलन कार्यक्रम \(Leprosy Eradication Portal\)/g,
  'NLEP - राष्ट्रीय कुष्ठरोग निर्मूलन कार्यक्रम'
);

html = html.replace(
  /<p style="margin:0 0 8px 0; font-size:13\.5px; color:#334155; line-height:1\.6;">\s*भादा प्राथमिक आरोग्य केंद्र कार्यक्षेत्रात[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g,
  '</div></div>'
);

html = html.replace(
  /📋\s*नियोजित फॉर्म्स व उप-मॉड्यूल्स\s*\(Roadmap of NLEP Features\):/g,
  'नियोजित मॉड्यूल्स'
);

html = html.replace(
  /<div style="font-weight:700; color:#9f1239; font-size:14px; margin-bottom:6px;">1\. कुष्ठरोग शोध मोहीम व संशयित नोंदी \(LCDC\)<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#9f1239; font-size:14px;">१. कुष्ठरोग शोध मोहीम</div>'
);

html = html.replace(
  /<div style="font-weight:700; color:#9f1239; font-size:14px; margin-bottom:6px;">2\. वैद्यकीय निदान व वर्गीकरण \(PB \/ MB Case Register\)<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#9f1239; font-size:14px;">२. वैद्यकीय निदान व वर्गीकरण</div>'
);

html = html.replace(
  /<div style="font-weight:700; color:#9f1239; font-size:14px; margin-bottom:6px;">3\. MDT औषधोपचार व RFT \(Release From Treatment\)<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#9f1239; font-size:14px;">३. MDT औषधोपचार</div>'
);

html = html.replace(
  /<div style="font-weight:700; color:#9f1239; font-size:14px; margin-bottom:6px;">4\. DPMR, MCR पादत्राणे व पुनर्वसन<\/div>\s*<p style="font-size:12\.5px; color:#475569; margin:0;">[^<]*<\/p>/g,
  '<div style="font-weight:700; color:#9f1239; font-size:14px;">४. विकृती प्रतिबंध व पुनर्वसन</div>'
);

// 3. Clean NWBDCP Import Section Guidelines
html = html.replace(
  /📋\s*कॉलम हेडिंग्स व युनिकोड मार्गदर्शक\s*\(Required Columns\):/g,
  'आवश्यक कॉलम:'
);

html = html.replace(
  /📥\s*जुने नमुने भरण्यासाठी रेडीमेड टॅम्पलेट डाऊनलोड करा:/g,
  'टेम्पलेट डाउनलोड:'
);

// 4. Clean NWBDCP Headers & Subtabs
html = html.replace(
  /<span>कार्यक्रम निवडा \(Switch Program\)<\/span>/g,
  '<span>कार्यक्रम निवडा</span>'
);

html = html.replace(
  /<span>💧 NWBDCP - पाणी गुणवत्ता व नमुना व्यवस्थापन प्रणाली<\/span>\s*<span[^>]*>Water Quality Module<\/span>/g,
  '<span>💧 NWBDCP - पाणी गुणवत्ता व्यवस्थापन</span>'
);

html = html.replace(
  /<span>🔒 NWBDCP प्रमाणीकरण \(Google Sign-In\):<\/span>/g,
  '<span>प्रमाणीकरण:</span>'
);

// 5. Clean Navigation Drawer & Sidebar Menu Buttons
html = html.replace(
  /⬅️ मुख्य कार्यक्रम निवडा \(Select Program\)/g,
  'मुख्य कार्यक्रम निवडा'
);

html = html.replace(
  /📝 डेटा एन्ट्री \(Daily & OPD\)/g,
  '📝 डेटा एन्ट्री'
);

html = html.replace(
  /📝 डेटा एन्ट्री \(Daily\/OPD\)/g,
  '📝 डेटा एन्ट्री'
);

html = html.replace(
  /🦟 डेंगी व चिकनगुनिया सिरम नमुने/g,
  '🦟 डेंगी व चिकनगुनिया'
);

html = html.replace(
  /🦟 डेंगी व चिकनगुनिया \(Dengue\)/g,
  '🦟 डेंगी व चिकनगुनिया'
);

html = html.replace(
  /🏛️ मास्टर व्यवस्थापन \(Masters\)/g,
  '🏛️ मास्टर व्यवस्थापन'
);

html = html.replace(
  /📤 डेटा अपलोड व प्रमाणीकरण \(CSV Upload\)/g,
  '📤 डेटा अपलोड'
);

html = html.replace(
  /📤 डेटा अपलोड \(CSV Upload\)/g,
  '📤 डेटा अपलोड'
);

html = html.replace(
  /📋 डेटा तक्ते \(Tables\)/g,
  '📋 डेटा तक्ते'
);

html = html.replace(
  /📑 अहवाल व नोटीस \(Reports\)/g,
  '📑 अहवाल व नोटीस'
);

// 6. Clean Recharts Analytics Heading & Subtitle
html = html.replace(
  /<span>📈<\/span>\s*गावनिहाय व कर्मचारीनिहाय डेटा वितरण विश्लेषण \(Recharts Analytics\)/g,
  'गावनिहाय व कर्मचारीनिहाय विश्लेषण'
);

html = html.replace(
  /<p style="margin:4px 0 0 0; font-size:13px; color:#4a5568;">\s*प्राथमिक आरोग्य केंद्र भादा अंतर्गत ६५ कर्मचारी, ३० गावे आणि ८ उपकेंद्रांचे सर्वसमावेशक चार्ट विश्लेषण\s*<\/p>/g,
  ''
);

// 7. Remove Dangling Formula Box and Broken Fragment in Data Entry
html = html.replace(
  /<div style="background:#ebf8ff; color:#2b6cb0; font-size:12\.5px; font-weight:700; padding:6px 12px; border-radius:6px; margin-top:10px; text-align:center;">\s*⚡ सूत्र: पायरी १ \(दैनिक रक्त नमुने\) ➔ पायरी २ \(मासिक १\. ओपीडी\) ➔ पायरी ३ \(मासिक २\. गृहभेटी\) ➔ अहवाल जनरेट\s*<\/div>\s*<\/div>\s*<\/div>/g,
  ''
);

// 8. Clean Indicator Cards: Titles, Badges, Labels
html = html.replace(
  /<span>🏥 १\. नवीन बाह्यरुग्ण \(New OPD\)<\/span>\s*<span[^>]*>✅ ॲक्टिव्ह \(Active\)<\/span>/g,
  '<span>नवीन बाह्यरुग्ण</span>'
);

html = html.replace(
  /<span>🌡️ २\. तापाचे रुग्ण \(Fever Cases\)<\/span>\s*<span[^>]*>🔒 इनॲक्टिव्ह<\/span>/g,
  '<span>तापाचे रुग्ण</span>'
);

html = html.replace(
  /<span>🩸 ३\. घेतलेले रक्त नमुणे \(Blood Smears\)<\/span>\s*<span[^>]*>🔒 इनॲक्टिव्ह<\/span>/g,
  '<span>घेतलेले रक्त नमुने</span>'
);

html = html.replace(
  /<span>💊 ४\. उपचारीत रुग्ण \(Treated Patients\)<\/span>\s*<span[^>]*>🔒 इनॲक्टिव्ह<\/span>/g,
  '<span>उपचारीत रुग्ण</span>'
);

html = html.replace(
  /<span>⚪ ५\. क्लोरोक्वीन गोळया खर्च \(Chloroquine\)<\/span>\s*<span[^>]*>🔒 इनॲक्टिव्ह<\/span>/g,
  '<span>क्लोरोक्वीन गोळ्या खर्च</span>'
);

html = html.replace(
  /<span>🚶‍♂️<\/span>\s*<span>स्वतंत्र गृहभेटी नोंदणी फॉर्म \(Standalone Home Visit Entry Form - MPW & ANM\)<\/span>\s*<span[^>]*>NVBDCP १०\.१४<\/span>/g,
  '<span>गृहभेटी नोंदणी</span>'
);

html = html.replace(
  /<span>🚶‍♂️ ६\. आरोग्य सेवक \(MPW\) गृहभेटी \(आदिवासी \/ ग्रामीण\)<\/span>\s*<span[^>]*>पंधरवडा १ व २<\/span>/g,
  '<span>आरोग्य सेवक (MPW) गृहभेटी</span>'
);

html = html.replace(
  /<span>👩‍⚕️ ७\. आरोग्य सेविका \(ANM\) गृहभेटी \(आदिवासी \/ ग्रामीण\)<\/span>\s*<span[^>]*>पंधरवडा १ व २<\/span>/g,
  '<span>आरोग्य सेविका (ANM) गृहभेटी</span>'
);

html = html.replace(
  /<b style="color:var\(--primary-dark\); font-size:14\.5px;">मासिक अहवाल थेट पूर्वावलोकन \(Live Template Report Preview\)<\/b>/g,
  '<b style="color:var(--primary-dark); font-size:14.5px;">मासिक अहवाल पूर्वावलोकन</b>'
);

// Clean up hints like "🔒 स्वयं-गणना", "🔒 १+२", "🔒 प्रगत"
html = html.replace(/<span style="font-size:11px; background:#edf2f7; color:#4a5568; padding:1px 6px; border-radius:4px; font-weight:600;">🔒 स्वयं-गणना<\/span>/g, '');
html = html.replace(/<span style="font-size:11px; background:#edf2f7; color:#718096; padding:1px 6px; border-radius:4px; font-weight:600;">🔒 स्वयं-गणना<\/span>/g, '');
html = html.replace(/<span style="font-size:10px; background:#edf2f7; color:#4a5568; padding:1px 4px; border-radius:3px;">🔒 १\+२<\/span>/g, '');
html = html.replace(/<span style="font-size:10px; background:#edf2f7; color:#4a5568; padding:1px 4px; border-radius:3px;">🔒 प्रगत<\/span>/g, '');

// Clean indicator field labels
html = html.replace(/मासिक संख्या \(तापाच्या रुग्णांनुसार\)/g, 'मासिक संख्या');
html = html.replace(/मासिक गोळ्या खर्च \(स्वयं-गणना\)/g, 'मासिक गोळ्या खर्च');
html = html.replace(/प्रगत गोळ्या खर्च \(YTD\)/g, 'प्रगत गोळ्या खर्च');
html = html.replace(/प्रगत \(YTD\)/g, 'प्रगत');

// Remove 3-step badges
html = html.replace(/<span class="card-badge">३-पायऱ्या पडताळणी<\/span>/g, '');
html = html.replace(/<span style="font-size:11px; background:#ebf8ff; color:#2b6cb0; border:1px solid #bee3f8; padding:3px 8px; border-radius:12px; font-weight:600;">\s*३-पायऱ्या पडताळणी प्रमाणित\s*<\/span>/g, '');

// 9. Clean Dengue Form & Batch Fields
html = html.replace(/<option value="FEMALE">स्त्री \(FEMALE\)<\/option>/g, '<option value="FEMALE">स्त्री</option>');
html = html.replace(/<option value="MALE">पुरुष \(MALE\)<\/option>/g, '<option value="MALE">पुरुष</option>');
html = html.replace(/<option value="OTHER">इतर \(OTHER\)<\/option>/g, '<option value="OTHER">इतर</option>');

html = html.replace(/<option value="No" selected>No \(नाही\)<\/option>/g, '<option value="No" selected>नाही</option>');
html = html.replace(/<option value="Yes">Yes \(होय\)<\/option>/g, '<option value="Yes">होय</option>');

html = html.replace(/🦟 डेंगी अहवाल \(Dengue\)/g, 'डेंगी अहवाल');
html = html.replace(/🦠 चिकनगुनिया अहवाल \(Chik\)/g, 'चिकनगुनिया अहवाल');
html = html.replace(/⭐ दोन्ही एकत्र \(Both\)/g, 'दोन्ही एकत्र');

html = html.replace(
  /📎 GMC एकत्रित अहवाल पत्र स्कॅन प्रत \(Upload Consolidated Batch PDF \/ Image\)/g,
  'अहवाल प्रत अपलोड'
);

html = html.replace(
  /📝 एकत्रित शेरा \/ टीप \(Common Remarks\)/g,
  'शेरा'
);

// 10. Clean Dengue Bulk Upload / Old Data Tab
html = html.replace(
  /<div style="font-size:12\.5px; color:#276749; margin-top:4px; line-height:1\.5; font-weight:600;">\s*💡 <b>टीप:<\/b>[\s\S]*?<\/div>/g,
  ''
);

html = html.replace(
  /<span>📥<\/span>\s*नमुना टेम्पलेट डाऊनलोड करा \(Download Bulk Import Sample Template\)/g,
  'नमुना टेम्पलेट डाउनलोड'
);

html = html.replace(
  /📗 Excel फॉरमॅट \(\.XLS - स्पष्ट मराठी\)/g,
  'Excel फॉरमॅट (.XLS)'
);

html = html.replace(
  /📄 CSV फॉरमॅट \(Clean English Headers\)/g,
  'CSV फॉरमॅट (.CSV)'
);

html = html.replace(
  /१\. डेटा आयात पद्धत निवडा \(Import Mode\):/g,
  'डेटा आयात पद्धत:'
);

html = html.replace(
  /<span>🟢 <b>नवीन नोंदी जोडा \(Append\)<\/b> - विद्यमान डेटा कायम ठेवून जुन्या नोंदी जोडा<\/span>/g,
  '<span>नवीन नोंदी जोडा (Append)</span>'
);

html = html.replace(
  /<span>🔴 <b>सर्व डेटा बदला \(Replace\)<\/b> - आधीचा संपूर्ण डेटा हटवून नवीन डेटा टाका<\/span>/g,
  '<span>सर्व डेटा बदला (Replace)</span>'
);

html = html.replace(
  /२\. Excel किंवा CSV फाईल निवडा \(Select Excel \/ CSV File\):/g,
  'Excel किंवा CSV फाईल निवडा:'
);

html = html.replace(
  /<div style="font-size:13\.5px; font-weight:700; color:#4a5568; margin-bottom:6px;">\s*डेंगी \/ चिकनगुनिया जुन्या नोंदींची Excel \(\.XLSX \/ \.XLS\) किंवा CSV फाईल येथे निवडा\s*<\/div>\s*<div style="font-size:12px; color:#718096; margin-bottom:14px;">\s*Excel फाईल थेट निवडा किंवा 'CSV \/ Text' फाईल अपलोड करा \(ऑटो-पार्स व व्हॅलिडेट होईल\)\.\s*<\/div>/g,
  ''
);

html = html.replace(
  /📁 Excel \/ CSV फाईल निवडा \(Choose File\)/g,
  'फाईल निवडा'
);

html = html.replace(
  /📝 किंवा थेट CSV डेटा पेस्ट करा \(Paste CSV Text\) ▾/g,
  'CSV डेटा पेस्ट करा ▾'
);

html = html.replace(
  /⚡ डेटा पार्स व तपासा \(Parse & Validate Preview\)/g,
  'डेटा तपासा'
);

html = html.replace(
  /🔄 साफ करा \(Clear\)/g,
  'साफ करा'
);

html = html.replace(
  /📊 एकूण पार्स केलेल्या ओळी \(Total Rows\)/g,
  'एकूण ओळी'
);

html = html.replace(
  /🟢 वैध रुग्ण नोंदी \(Valid Records\)/g,
  'वैध नोंदी'
);

html = html.replace(
  /⚡ ऑटो-दुरुस्त दिनांक \(Normalized Dates\)/g,
  'दिनांक दुरुस्त'
);

html = html.replace(
  /❌ त्रुटी \/ वगळलेल्या ओळी \(Empty Rows\)/g,
  'त्रुटी / वगळलेल्या'
);

html = html.replace(
  /🔍 डेटा पडताळणी पूर्वावलोकन \(Data Verification Preview - पहिली २० नोंदी\):/g,
  'डेटा पडताळणी पूर्वावलोकन:'
);

html = html.replace(
  /<th class="text-left">रुग्णाचे नाव \(Patient Name\)<\/th>/g,
  '<th class="text-left">रुग्णाचे नाव</th>'
);

html = html.replace(
  /💾 सर्व नोंदी डेटाबेसमध्ये आयात व जतन करा \(Commit & Import to Database\)/g,
  'डेटा आयात व जतन करा'
);

// 11. Clean Master Data Tab Banners & Descriptions
html = html.replace(
  /<h4 style="margin:0 0 5px 0; color:#2b6cb0; font-size:16px;">🔄 कर्मचारी बदली सुविधा \(Employee Transfer Facility\)<\/h4>\s*<p style="margin:0; font-size:13px; color:#4a5568;">[\s\S]*?<\/p>/g,
  '<h4 style="margin:0; color:#2b6cb0; font-size:16px;">कर्मचारी बदली</h4>'
);

html = html.replace(
  /🔄 नवीन बदली आदेश नोंदवा \(New Transfer\)/g,
  'नवीन बदली आदेश'
);

html = html.replace(
  /📋 बदली इतिहास नोंदवही \(Transfer History Log\)/g,
  'बदली इतिहास नोंदवही'
);

html = html.replace(
  /<h4 style="margin:0 0 5px 0; color:#c05621; font-size:16px;">🏷️ उपकेंद्रनिहाय कायम BS Codes, पदभार व सेवा समाप्ती \(BS Code & Service Attachment\)<\/h4>\s*<p style="margin:0; font-size:13px; color:#4a5568;">[\s\S]*?<\/p>/g,
  '<h4 style="margin:0; color:#c05621; font-size:16px;">BS Codes व पदभार</h4>'
);

html = html.replace(
  /🔗 BS कोडला कर्मचारी जोडा \(Attach\)/g,
  'BS कोड संलग्न करा'
);

html = html.replace(
  /<div>मास्टर डेटा व तक्ते व्यवस्थापन \(Master Data & Records Center\)<\/div>/g,
  '<div>मास्टर डेटा व तक्ते</div>'
);

html = html.replace(
  /☁️ Firestore ट्रान्सफर \(BS, उपकेंद्र, कर्मचारी, गाव डेटा\)/g,
  'Firestore ट्रान्सफर'
);

html = html.replace(
  /📂 डेटा आयात केंद्र \(CSV \/ Excel\)/g,
  'डेटा आयात'
);

// 12. Clean Modals
html = html.replace(
  /<option value="बदली \(Transfer\)">बदली \(Transfer - इतरत्र बदली झाल्याने\)<\/option>/g,
  '<option value="बदली (Transfer)">बदली</option>'
);

html = html.replace(
  /<option value="अतिरिक्त पदभार समाप्त \(Additional Charge Relieved\)">अतिरिक्त पदभार समाप्त \(Additional Charge Relieved\)<\/option>/g,
  '<option value="अतिरिक्त पदभार समाप्त (Additional Charge Relieved)">अतिरिक्त पदभार समाप्त</option>'
);

html = html.replace(
  /<option value="नवीन कर्मचाऱ्यास पदभार दिल्याने कार्यमुक्त">नवीन कर्मचाऱ्यास पदभार दिल्याने कार्यमुक्त \(Handed over charge\)<\/option>/g,
  '<option value="नवीन कर्मचाऱ्यास पदभार दिल्याने कार्यमुक्त">नवीन कर्मचाऱ्यास पदभार दिल्याने कार्यमुक्त</option>'
);

html = html.replace(
  /<option value="सेवानिवृत्ती \(Retirement\)">सेवानिवृत्ती \(Retirement\)<\/option>/g,
  '<option value="सेवानिवृत्ती (Retirement)">सेवानिवृत्ती</option>'
);

html = html.replace(
  /<option value="राजीनामा \(Resignation\)">राजीनामा \(Resignation\)<\/option>/g,
  '<option value="राजीनामा (Resignation)">राजीनामा</option>'
);

html = html.replace(
  /<option value="इतर प्रशासकीय कारण">इतर प्रशासकीय कारण \(Other Administrative Reason\)<\/option>/g,
  '<option value="इतर प्रशासकीय कारण">इतर प्रशासकीय कारण</option>'
);

html = html.replace(
  /<span>मागील कर्मचाऱ्याची सेवा समाप्त \(End Service\) करून हा BS कोड नवीन कर्मचाऱ्याला द्या\.<\/span>/g,
  '<span>मागील कर्मचाऱ्याची सेवा समाप्त करून हा BS कोड द्या.</span>'
);

html = html.replace(
  /<option value="REGULAR">नियमित पदभार \(Regular Charge\)<\/option>/g,
  '<option value="REGULAR">नियमित पदभार</option>'
);

html = html.replace(
  /<option value="ADDITIONAL">अतिरिक्त पदभार \(Additional Charge\)<\/option>/g,
  '<option value="ADDITIONAL">अतिरिक्त पदभार</option>'
);

html = html.replace(
  /<option value="TRANSFER">बदलीने नियुक्ती \(Transfer Assignment\)<\/option>/g,
  '<option value="TRANSFER">बदलीने नियुक्ती</option>'
);

// Dengue Lab Report Modal
html = html.replace(
  /<h4 style="margin:0; font-size:15px; font-weight:800; color:#9a3412;">डेंगी चाचणी अहवाल \(Dengue Test\)<\/h4>/g,
  '<h4 style="margin:0; font-size:15px; font-weight:800; color:#9a3412;">डेंगी चाचणी अहवाल</h4>'
);

html = html.replace(
  /<h4 style="margin:0; font-size:15px; font-weight:800; color:#9a3412;">चिकनगुनिया चाचणी अहवाल \(Chikungunya Test\)<\/h4>/g,
  '<h4 style="margin:0; font-size:15px; font-weight:800; color:#9a3412;">चिकनगुनिया चाचणी अहवाल</h4>'
);

html = html.replace(
  /१\. अहवाल निष्कर्ष \(Test Result\)/g,
  'अहवाल निष्कर्ष'
);

html = html.replace(
  /<option value="Pending">⏳ Pending \(प्रलंबित \/ अद्याप प्राप्त नाही\)<\/option>/g,
  '<option value="Pending">प्रलंबित (Pending)</option>'
);

html = html.replace(
  /<option value="Positive" style="color:#c53030; font-weight:700;">🔴 Positive \(पॉझिटिव्ह \/ बाधित\)<\/option>/g,
  '<option value="Positive" style="color:#c53030; font-weight:700;">पॉझिटिव्ह (Positive)</option>'
);

html = html.replace(
  /<option value="Negative" style="color:#276749; font-weight:700;">🟢 Negative \(निगेटिव्ह \/ दोषमुक्त\)<\/option>/g,
  '<option value="Negative" style="color:#276749; font-weight:700;">निगेटिव्ह (Negative)</option>'
);

html = html.replace(
  /<option value="Equivocal" style="color:#c05621; font-weight:700;">🟠 Equivocal \(संशयित \/ अनिश्चित\)<\/option>/g,
  '<option value="Equivocal" style="color:#c05621; font-weight:700;">संशयित (Equivocal)</option>'
);

html = html.replace(
  /२\. चाचणी प्रकार \(Test Type\)/g,
  'चाचणी प्रकार'
);

html = html.replace(
  /३\. अहवाल प्राप्त दिनांक/g,
  'अहवाल प्राप्त दिनांक'
);

html = html.replace(
  /४\. प्रयोगशाळा अहवाल संदर्भ क्र\. \(Report Ref No\)/g,
  'अहवाल संदर्भ क्र.'
);

html = html.replace(
  /५\. प्रयोगशाळा अहवाल फाईल \(Upload Report File\)/g,
  'प्रयोगशाळा अहवाल फाईल'
);

html = html.replace(
  /६\. शेरा \/ टीप \(Remarks\)/g,
  'शेरा'
);

// NWBDCP Retest Modal
html = html.replace(
  /<span>✏️ पुनर्तपासणी निकाल व प्रयोगशाळा अहवाल नोंदवा<\/span>/g,
  '<span>पुनर्तपासणी अहवाल नोंदवा</span>'
);

html = html.replace(
  /<option value="पिण्यास योग्य" style="color:#166534; font-weight:800;">🟢 पिण्यास योग्य \(Safe\)<\/option>/g,
  '<option value="पिण्यास योग्य" style="color:#166534; font-weight:800;">पिण्यास योग्य</option>'
);

html = html.replace(
  /<option value="पिण्यास अयोग्य" style="color:#dc2626; font-weight:800;">🔴 पिण्यास अयोग्य \(Still Contaminated \/ Unfit\)<\/option>/g,
  '<option value="पिण्यास अयोग्य" style="color:#dc2626; font-weight:800;">पिण्यास अयोग्य</option>'
);

html = html.replace(
  /<option value="अहवाल अप्राप्त">🟡 अहवाल अप्राप्त \(Awaited\)<\/option>/g,
  '<option value="अहवाल अप्राप्त">अहवाल अप्राप्त</option>'
);

html = html.replace(
  /<span>🚨 ग्रामपंचायत तातडीची दूषित जलस्त्रोत सूचना व सुधारणा आदेश<\/span>/g,
  '<span>दूषित जलस्त्रोत सूचना</span>'
);

html = html.replace(
  /🖨️ नोटीस प्रिंट काढा \(Print \/ PDF\)/g,
  'प्रिंट काढा'
);

// 13. Reports Tab Buttons
html = html.replace(
  /🛡️ Validator \(त्रुटी तपासा\)/g,
  'डेटा तपासा'
);

html = html.replace(
  /🛡️ त्रुटी व्हॅलिडेट करा \(Run Validator\)/g,
  'डेटा तपासा'
);

html = html.replace(
  /<h3 style="color:#dd6b20; margin-top:0;">🖨️ दैनिक पत्र<\/h3>/g,
  '<h3 style="color:#dd6b20; margin-top:0;">दैनिक पत्र</h3>'
);

html = html.replace(
  /<h3 style="color:#2f855a; margin-top:0;">📗 कर्मचारी नोंदवही<\/h3>/g,
  '<h3 style="color:#2f855a; margin-top:0;">कर्मचारी नोंदवही</h3>'
);

html = html.replace(
  /<h3 style="color:#c53030; margin-top:0;">⚠️ कारणे दाखवा नोटीस<\/h3>/g,
  '<h3 style="color:#c53030; margin-top:0;">कारणे दाखवा नोटीस</h3>'
);

html = html.replace(
  /<h3 style="color:#6b46c1; margin-top:0;">📉 कमी कामगिरी अहवाल<\/h3>/g,
  '<h3 style="color:#6b46c1; margin-top:0;">कमी कामगिरी अहवाल</h3>'
);

fs.writeFileSync(filePath, html, 'utf8');
console.log('Updated length:', html.length);

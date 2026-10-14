// Interface language: Hebrew (default) or English. Pure and DOM-free except for applyStatic().
//
// Every player picks a language for their own phone. Nothing about the language is stored in the table state, so a
// table can mix languages freely. Player names and chat messages are shown exactly as typed.
//
// The game logic (game.js, sync.js, server) keeps producing Hebrew error messages; tErr() maps them to English on the
// way to the screen, so no protocol or reducer change was needed.
//
// A value is a string with {placeholders}, or a function of the params (for plurals and the like). Params that carry
// player names must already be HTML-escaped by the caller; the dictionary strings themselves are trusted.

export const LANGS = ['he', 'en'];
const KEY = 'mdc.lang';

const one = (n, s, p) => (n === 1 ? s : p);

const he = {
  'app.title': 'הקופסה',
  'lang.other': 'English',
  'lang.aria': 'החלף שפה לאנגלית',

  // roles and tokens (names without an article, article form for sentences)
  'role.henchman': 'חייל נאמן', 'role.fbi': 'סוכן FBI', 'role.cia': 'סוכן CIA', 'role.driver': 'נהג', 'role.cleaner': 'המנקה',
  'role.godfather': 'הסנדק', 'role.thief': 'גנב', 'role.urchin': 'ילד רחוב',
  'roleA.henchman': 'חייל נאמן', 'roleA.fbi': 'סוכן FBI', 'roleA.cia': 'סוכן CIA', 'roleA.driver': 'נהג', 'roleA.cleaner': 'המנקה',
  'roleA.godfather': 'הסנדק', 'roleA.thief': 'גנב', 'roleA.urchin': 'ילד רחוב',

  'goal.godfather': 'להחזיר את כל היהלומים שנגנבו. כל האשמה של מי שלא גנב עולה לך וויסקי, ואם נגמר הוויסקי, אתה מודח.',
  'goal.thief': 'לא להיתפס. אם הסנדק מודח, הגנב עם הכי הרבה יהלומים שעוד במשחק מנצח.',
  'goal.henchman': 'לעזור לסנדק לתפוס את הגנבים. אתה מנצח אם הסנדק מחזיר את כל היהלומים.',
  'goal.agent': 'לגרום לסנדק להאשים אותך. אם הוא מאשים אותך, אתה מנצח לבד.',
  'goal.driver': 'אתה מנצח אם השחקן שמימינך מנצח: {name}.',
  'goal.cleaner': 'אתה בצד של הסנדק. כשהסנדק מאשים מישהו, אפשר ללחוץ POW לפני החשיפה: על סוכן אתה מנצח לבד, ועל כל אחד אחר שניכם מודחים.',
  'goal.urchin': 'אין לך כלום בכיס, אבל אף אחד לא יודע. תמשוך חשד כדי שהסנדק יבזבז וויסקי. אתה מנצח אם גנב מנצח.',

  'player': 'שחקן',
  'noTokens': 'אין טוקנים',
  'solo.new': 'שולחן חדש',

  // boot / connection
  'boot.loading': 'טוען…',
  'boot.fail': 'לא הצלחתי להתחבר לשרת. רעננו את הדף.',
  'toast.noTable': 'לא מצאתי שולחן עם הקוד הזה',
  'toast.wrong': 'משהו השתבש. נסו שוב.',
  'connecting': 'מתחבר לשולחן {code}…',
  'waitHost': 'מחכה לטלפון של המארח. ודאו שהאפליקציה פתוחה אצלו.',
  'backHome': 'חזרה למסך הראשי',
  'offline.p2p': 'אין חיבור לטלפון של המארח. מתחבר מחדש… אם הוא לא יחזור בעוד רגע, השולחן ייסגר.',
  'offline.server': 'אין חיבור לשרת המקומי. בדקו שהטלפון על אותה רשת Wi-Fi. המשחק ימשיך כשהחיבור יחזור.',
  'offline.net': 'אין חיבור לאינטרנט. המשחק ימשיך כשהחיבור יחזור.',
  'test.tabs': 'מצב בדיקה: אין חיבור לשרת, אז כל ה"טלפונים" צריכים להיות לשוניות באותו דפדפן.',
  'test.home': 'מצב בדיקה: עדיין לא מחובר לשרת. אפשר לנסות עם כמה לשוניות באותו דפדפן.',

  // header
  'band.code': 'קוד שולחן',
  'band.rules': 'חוקים',
  'band.menu': 'תפריט',

  // home
  'home.band': 'הוואנה · 1958',
  'home.sub': 'אפליקציה נלווית ל־Mafia de Cuba: הקופסה, היהלומים והטוקנים עוברים בטלפונים. החקירה נשארת סביב השולחן.',
  'home.closedTitle': 'השולחן נסגר',
  'home.closedText': 'המארח סגר את השולחן או שהתנתק, וזה סוף המשחק. אפשר לפתוח שולחן חדש או להצטרף לאחר.',
  'field.name': 'השם שלך',
  'field.namePh': 'למשל: דון אלסנדרו',
  'home.join': 'הצטרפות לשולחן',
  'home.joinBtn': 'הצטרף',
  'home.or': 'או',
  'home.create': 'פתח שולחן חדש',
  'home.disclaimer': 'אפליקציה לא רשמית, ללא קשר ל־Lui-même. נדרש עותק של המשחק Mafia de Cuba.',
  'toast.needName': 'צריך שם כדי לשבת לשולחן',
  'toast.createFail': 'לא הצלחתי לפתוח שולחן. בדקו את החיבור.',
  'toast.createRetry': 'לא הצלחתי לפתוח שולחן. נסו שוב.',
  'toast.code4': 'הקוד הוא 4 ספרות',

  // outsider
  'out.joining': 'מצטרף לשולחן…',
  'out.sit': 'שב לשולחן',
  'out.started': 'הסיבוב כבר התחיל',
  'out.startedText': 'תיכנס אוטומטית לסיבוב הבא, כשהמארח יחזיר את כולם ללובי.',

  // lobby
  'tag.godfather': 'סנדק',
  'tag.host': 'מארח',
  'aria.setGf': 'קבע כסנדק',
  'aria.kick': 'הוצא מהשולחן',
  'aria.drag': 'גרור כדי לשנות מקום (או חצים במקלדת)',
  'lobby.table': 'שולחן {code}',
  'lobby.round': ' · סיבוב {n}',
  'lobby.count': (p) => `${p.n} ${one(p.n, 'שחקן', 'שחקנים')} ליד השולחן`,
  'lobby.qr': 'ברקוד להצטרפות',
  'lobby.scan': 'סרקו עם המצלמה, או הכנסו לאפליקציה והקלידו את הקוד <b class="num">{code}</b>.',
  'lobby.copy': 'העתק קישור',
  'lobby.hostPhone': 'הטלפון שלך מחזיק את השולחן. השאירו את האפליקציה פתוחה עד סוף הערב.',
  'lobby.seats': 'מקומות ישיבה',
  'lobby.seatsHost': 'סדרו לפי הישיבה האמיתית עם כיוון השעון. הקופסה עוברת לפי הסדר הזה, מהשחקן שאחרי הסנדק.',
  'lobby.seatsGuest': 'המארח מסדר את המקומות לפי הישיבה ובוחר סנדק.',
  'lobby.settings': 'הגדרות',
  'lobby.cleaner': 'לשחק עם המנקה',
  'lobby.cleanerHint': '(לא מומלץ במשחקים הראשונים)',
  'lobby.whiskey': 'וויסקי לסנדק',
  'lobby.whiskeyHint': '(במשחק של 5 אין וויסקי)',
  'aria.less': 'פחות',
  'aria.more': 'יותר',
  'lobby.inBox': 'בקופסה יהיו',
  'lobby.diamonds15': '15 יהלומים',
  'lobby.five': 'משחק של 5 שחקנים קשה יותר ולא מומלץ למשחק ראשון.',
  'lobby.start': 'התחל סיבוב · {name} הסנדק',
  'lobby.need': 'מחכים לעוד {n} שחקנים לפחות',
  'lobby.waitHost': 'מחכים ש{name} יתחיל את הסיבוב.',
  'chip.agentEither': 'סוכן FBI או CIA',
  'chip.agentNote': 'איזה סוכן ייכנס לקופסה נקבע בהגרלה.',

  // setup
  'setup.preparing': '{name} מכין את הקופסה',
  'setup.preparingText': 'הסנדק מחביא בכיס בין 0 ל־5 יהלומים. בעוד רגע הקופסה תתחיל לעבור.',
  'boxOrder': 'סדר הקופסה',
  'setup.youGf': 'אתה הסנדק',
  'setup.howMany': 'כמה יהלומים להחביא בכיס?',
  'setup.nobody': 'אף אחד לא יודע כמה החבאת. ככה הגנבים לא יכולים לחשב בדיוק כמה חסר.',
  'setup.stay': 'בקופסה יישארו {n} יהלומים',
  'setup.close': 'סגור את הקופסה ושלח ל{name}',

  // seat list / pocket
  'seat.box': 'הקופסה אצלו',
  'seat.passed': 'העביר',
  'seat.whiskey': '{n} וויסקי',
  'seat.out': 'מודח',
  'seat.you': ' (אתה)',
  'pocket.gf': 'בכיס שלך: <b class="num">{n}</b> יהלומים שהחבאת. {goal}',
  'pocket.hold': 'החזק כדי לראות מה בכיס',
  'pocket.title': 'הכיס שלי',
  'pocket.peek': 'החזק את האצבע כדי להציץ. שימו לב לשכנים.',
  'pocket.whiskey': '{n} וויסקי מהסנדק',
  'pocket.thiefN': ' · <span class="num">{n}</span> יהלומים',

  // theft
  'theft.next': 'אתה הבא בתור.',
  'theft.ahead': 'עוד {n} שחקנים לפניך.',
  'theft.eyebrow': 'גניבת היהלומים',
  'theft.boxWith': 'הקופסה אצל {name}',
  'theft.yourTurn': 'תורך · {n} מתוך {total}',
  'box.label': 'קופסת הסנדק',
  'box.yours': 'הקופסה אצלך',
  'box.hide': 'תסתיר את המסך מהשכנים, ותפתח.',
  'box.open': 'פתח את הקופסה',
  'box.tokens': 'טוקנים בקופסה',
  'box.remember': 'תזכור מה ראית: אחר כך תצטרך להעיד, או לשקר בצורה משכנעת.',
  'box.emptyTitle': 'הקופסה ריקה. אתה ילד רחוב.',
  'box.emptyText': 'תעמיד פנים שאתה לוקח משהו, ותעביר הלאה.',
  'box.pretended': 'העמדתי פנים. העבר הלאה',
  'bag.title': 'השקית: רק לשחקן הראשון',
  'bag.text': 'אפשר להעלים טוקן אחד לשקית עד סוף המשחק. אף אחד לא יידע איזה. אחר כך לוקחים כרגיל.',
  'bag.none': 'לא להעלים כלום',
  'take.choose': 'בחר מה לקחת',
  'take.diamonds': (p) => `קח ${p.n} ${one(p.n, 'יהלום', 'יהלומים')} והעבר`,
  'take.token': 'קח {token} והעבר',
  'take.nothing': 'לא לקחת כלום והעבר',
  'take.title': 'מה לוקחים? חובה לקחת משהו',
  'take.diamondsBtn': 'יהלומים (לפחות אחד)',
  'take.howMany': 'כמה יהלומים לקחת',
  'take.orToken': 'או טוקן אחד:',
  'take.urchinBtn': 'לא לקחת כלום (ילד רחוב)',
  'take.urchinNote': 'אתה האחרון, אז מותר לך לא לקחת כלום. רק תעמיד פנים שכן.',
  'take.passTo': 'הקופסה תעבור ל{name}',
  'take.passToGf': 'הקופסה תעבור לסנדק',

  // investigation
  'inv.diamondsBack': 'יהלומים הוחזרו',
  'inv.whiskeyGf': 'וויסקי לסנדק',
  'inv.outCount': 'מודחים',
  'inv.log': 'מה קרה עד עכשיו',
  'inv.cleared': 'נוקה',
  'inv.accuse': 'האשם',
  'inv.eyebrowGf': 'החקירה · אתה הסנדק',
  'inv.stolen': 'נגנבו',
  'inv.recovered': 'הוחזרו',
  'inv.whiskey': 'וויסקי',
  'inv.cameBack': 'מה חזר בקופסה',
  'inv.hid': 'החבאת בכיס {n}. בהתחלה היו 15.',
  'inv.investigate': 'חקור ואז האשם',
  'inv.investigateText': 'שאלו בקול, ליד השולחן. כשאתה בטוח, לחץ "האשם" כדי לצעוק "רוקן את הכיסים!".',
  'inv.goodQ': 'שאלות טובות לשאול',
  'inv.q1': 'כשקיבלת את הקופסה, כמה יהלומים היו בה?',
  'inv.q2': 'אילו טוקנים היו בה?',
  'inv.q3': 'מה השארת כשהעברת הלאה?',
  'inv.q4': 'מה לקחת?',
  'inv.q5': 'מי ישב לפניך, ומה הוא אמר שהיה בקופסה?',
  'inv.youOut': 'הודחת',
  'inv.youOutText': 'מעכשיו אסור לך לדבר או להשתתף בחקירה.',
  'inv.eyebrow': 'החקירה',
  'inv.investigating': '{name} חוקר',
  'inv.answer': 'ענו בקול. מותר לשקר, להגזים, לשתוק או לסלף מה שאחרים אמרו.',
  'inv.atTable': 'ליד השולחן',

  // log lines
  'log.thief': '{who} נתפס עם {n} יהלומים והודח.',
  'log.innocentUrchin': '{who} הואשם, אבל הכיסים שלו ריקים. קיבל וויסקי.',
  'log.innocentRole': '{who} הואשם, אבל הוא {role}. קיבל וויסקי.',
  'log.agent': '{who} הוא {role}.',
  'log.godfatherOut': '{who} נקי, ולסנדק נגמר הוויסקי.',
  'log.powThief': 'גנב, {n} יהלומים חזרו',
  'log.powUrchin': 'כיסים ריקים',
  'log.pow': 'POW! {by} ירה ב{who} ({what}). שניהם הודחו.',
  'log.powAgent': 'POW! {by} חיסל את {who}, {role}.',

  // end
  'end.gf1': 'הסנדק החזיר את כל היהלומים', 'end.gf2': 'הסנדק, החיילים הנאמנים והמנקה מנצחים.',
  'end.agent1': 'הסנדק האשים סוכן', 'end.agent2': 'הסוכן מנצח לבד.',
  'end.cleaner1': 'POW! המנקה חיסל סוכן', 'end.cleaner2': 'המנקה מנצח לבד.',
  'end.thieves1': 'הסנדק הודח',
  'end.thieves2': 'הגנב עם הכי הרבה יהלומים מנצח, ואיתו ילדי הרחוב.',
  'end.thieves2none': 'לא נשאר גנב במשחק, אז אף גנב לא מנצח.',
  'end.over': 'הסיבוב נגמר',
  'end.nobody': 'אף אחד',
  'end.hid': 'החביא {n}',
  'end.won': 'ניצח',
  'end.eyebrow': 'סוף הסיבוב',
  'end.youWon': 'ניצחת!',
  'end.youLost': 'הפעם לא ניצחת',
  'end.winners': 'מנצחים: {names}',
  'end.whatEach': 'מה היה לכל אחד',
  'end.bag': 'בשקית: {bag} · נשארו בקופסה {n} יהלומים',
  'end.bagNone': 'כלום',
  'end.investigation': 'החקירה',
  'end.newRound': 'סיבוב חדש',
  'end.newRoundText': 'המנצחים בוחרים את הסנדק הבא. אפשר גם להחליף מקומות בלובי.',
  'end.nextGf': 'הסנדק הבא',
  'end.wonSuffix': ' (ניצח)',
  'end.backLobby': 'חזרה ללובי',
  'end.hostNew': '{name} יפתח סיבוב חדש.',
  'nDiamonds': '{n} יהלומים',

  // overlays
  'acc.costJokers': 'אם הוא לא גנב, תצטרך לתת לו וויסקי (נשארו לך {n}). אם הוא סוכן, הפסדת.',
  'acc.costNone': 'לא נשאר לך וויסקי: אם הוא לא גנב, אתה מודח. אם הוא סוכן, הפסדת.',
  'acc.cry': 'רוקן את הכיסים!',
  'acc.notYet': 'עוד לא',
  'acc.accuses': '{name} מאשים את',
  'acc.you': 'אותך!',
  'acc.pow': 'POW!',
  'acc.powNote': 'יש לך רגע אחד לפני שהכיסים מתרוקנים.',
  'rev.emptying': 'מרוקן את הכיסים…',
  'rev.thiefV': 'גנב! {n} יהלומים',
  'rev.thiefSub': '{who} מודח. היהלומים חזרו לסנדק.',
  'rev.emptyPockets': 'הכיסים ריקים',
  'rev.whoIs': '{who} הוא {role}',
  'rev.innocentSub': 'הסנדק טעה ונותן ל{who} וויסקי. נשארו לו {n}.',
  'rev.agentV': '{role}!',
  'rev.agentSub': '{who} היה סוכן סמוי. הסוכן מנצח.',
  'rev.gfOutV': 'הסנדק מודח',
  'rev.gfOutPockets': '{who} עם כיסים ריקים, ולסנדק אין יותר וויסקי.',
  'rev.gfOutRole': '{who} הוא {role}, ולסנדק אין יותר וויסקי.',
  'rev.powThief': ', שהיה גנב עם {n} יהלומים. היהלומים חזרו לסנדק',
  'rev.powOther': ', שהיה {role}',
  'rev.powUrchin': 'ילד רחוב',
  'rev.powSub': '{by} ירה ב{who}{what}. שניהם מודחים.',
  'rev.powAgentV': 'POW! סוכן חוסל',
  'rev.powAgentSub': '{by} הוא המנקה, ו{who} היה {role}. המנקה מנצח לבד.',
  'rev.continue': 'המשך',

  // menu
  'menu.title': 'תפריט',
  'menu.chatTtl': "זמן חיים להודעות בצ'אט (בשניות)",
  'menu.chatCd': 'השהייה בין הודעות של אותו שחקן (בשניות, 0 = בלי הגבלה)',
  'menu.save': 'שמור',
  'menu.abort': 'בטל את הסיבוב וחזור ללובי',
  'menu.hostNote': 'אתה המארח: הטלפון שלך מחזיק את השולחן. אם תסגור אותו, המשחק ייגמר לכולם.',
  'menu.closeTable': 'סגור את השולחן לכולם',
  'menu.leave': 'צא מהשולחן',
  'menu.close': 'סגור',
  'toast.needName2': 'צריך שם',
  'menu.ttlLabel': 'זמן החיים של ההודעות',
  'menu.cdLabel': 'ההשהייה בין הודעות',
  'menu.range': '{label} צריך להיות בין {min} ל־{max} שניות',
  'toast.saved': 'נשמר',
  'toast.linkCopied': 'הקישור הועתק',

  // rules
  'rules.aria': 'חוקים',
  'rules.title': 'איך משחקים',
  'rules.ok': 'הבנתי',
  'rules.html': `<p>משחק בלופים ל־6 עד 12 שחקנים. הטלפון מחליף רק את הקופסה, היהלומים והטוקנים. כל השאר קורה בקול סביב השולחן.</p>
    <h3>1. ההכנה</h3>
    <ul><li>הסנדק מחביא בכיס בין 0 ל־5 יהלומים מתוך 15.</li><li>בקופסה יש גם טוקנים של דמויות, לפי מספר השחקנים.</li></ul>
    <h3>2. גניבת היהלומים</h3>
    <ul>
      <li>הקופסה עוברת עם כיוון השעון, מהשחקן שמשמאל לסנדק.</li>
      <li>כל שחקן מסתכל בחשאי, זוכר מה ראה, ולוקח <b>לפחות יהלום אחד</b> או <b>טוקן אחד</b>. אסור לא לקחת כלום.</li>
      <li>השחקן הראשון יכול להעלים קודם טוקן אחד לשקית, עד סוף המשחק.</li>
      <li>מי שמקבל קופסה ריקה הופך לילד רחוב, ומעמיד פנים שהוא לוקח.</li>
      <li>השחקן האחרון יכול לבחור לא לקחת כלום ולהיות ילד רחוב.</li>
    </ul>
    <h3>3. החקירה</h3>
    <ul>
      <li>הסנדק שואל את מי שהוא רוצה, באיזה סדר שהוא רוצה. מותר לשקר, לשתוק ולסלף.</li>
      <li>כשהוא בטוח, הוא מאשים: "רוקן את הכיסים!".</li>
      <li><b>גנב:</b> היהלומים חוזרים לסנדק, והגנב מודח ואסור לו לדבר.</li>
      <li><b>מי שלא גנב:</b> הסנדק נותן לו וויסקי. אם לסנדק נגמר הוויסקי, הסנדק מודח.</li>
      <li><b>סוכן FBI או CIA:</b> המשחק נגמר והסוכן מנצח.</li>
    </ul>
    <h3>מי מנצח</h3>
    <ul>
      <li><b>הסנדק והחיילים הנאמנים:</b> אם הסנדק החזיר את כל היהלומים.</li>
      <li><b>סוכן:</b> אם הסנדק האשים אותו. מנצח לבד.</li>
      <li><b>גנב:</b> אם הסנדק הודח, הגנב שעוד במשחק עם הכי הרבה יהלומים מנצח. בתיקו, כולם מנצחים.</li>
      <li><b>ילד רחוב:</b> אם גנב מנצח.</li>
      <li><b>נהג:</b> אם השחקן שמימינו מנצח.</li>
      <li><b>המנקה (אופציונלי):</b> בצד של הסנדק. כשהסנדק מאשים, הוא יכול לצעוק POW! לפני החשיפה. על סוכן הוא מנצח לבד. על כל אחד אחר, שניהם מודחים: גנב מחזיר את היהלומים, ומי שלא גנב לא מקבל וויסקי.</li>
    </ul>
    <h3>שולחן עם הטלפונים</h3>
    <ul><li>המארח פותח שולחן, וכולם נכנסים עם הקוד או הברקוד.</li><li>סדרו את המקומות בלובי לפי הישיבה האמיתית.</li><li>"הכיס שלי": החזיקו את האצבע כדי להציץ במה שלקחתם.</li></ul>`,

  // chat
  'chat.title': "צ'אט",
  'chat.close': "סגור את הצ'אט",
  'chat.placeholder': 'הודעה…',
  'chat.messageAria': 'הודעה',
  'chat.send': 'שלח',
  'chat.empty': 'אין הודעות',
  'chat.note': 'ההודעות נעלמות אחרי {ttl}.',
  'chat.noteRate': ' אפשר לשלוח הודעה כל {cd}.',
  'dur.second': 'שנייה',
  'dur.minute': 'דקה',
  'dur.minutes': '{n} דקות',
  'dur.seconds': '{n} שניות',
};

const en = {
  'app.title': 'The Box',
  'lang.other': 'עברית',
  'lang.aria': 'Switch language to Hebrew',

  'role.henchman': 'Loyal Henchman', 'role.fbi': 'FBI Agent', 'role.cia': 'CIA Agent', 'role.driver': 'Driver', 'role.cleaner': 'Cleaner',
  'role.godfather': 'Godfather', 'role.thief': 'Thief', 'role.urchin': 'Street Urchin',
  'roleA.henchman': 'a loyal henchman', 'roleA.fbi': 'an FBI agent', 'roleA.cia': 'a CIA agent', 'roleA.driver': 'a driver', 'roleA.cleaner': 'the Cleaner',
  'roleA.godfather': 'the Godfather', 'roleA.thief': 'a thief', 'roleA.urchin': 'a street urchin',

  'goal.godfather': 'Get back every diamond that was stolen. Each time you accuse someone who is not a thief it costs you a whiskey, and if you run out of whiskey, you are out.',
  'goal.thief': "Don't get caught. If the Godfather is knocked out, the thief with the most diamonds still in the game wins.",
  'goal.henchman': 'Help the Godfather catch the thieves. You win if the Godfather gets back all the diamonds.',
  'goal.agent': 'Get the Godfather to accuse you. If he does, you win alone.',
  'goal.driver': 'You win if the player to your right wins: {name}.',
  'goal.cleaner': "You are on the Godfather's side. When the Godfather accuses someone, you can press POW before the reveal: on an agent you win alone, on anyone else you are both knocked out.",
  'goal.urchin': 'Your pockets are empty, but nobody knows it. Draw suspicion so the Godfather wastes whiskey. You win if a thief wins.',

  'player': 'Player',
  'noTokens': 'No tokens',
  'solo.new': 'New table',

  'boot.loading': 'Loading…',
  'boot.fail': 'Could not connect to the server. Refresh the page.',
  'toast.noTable': 'No table found with that code',
  'toast.wrong': 'Something went wrong. Try again.',
  'connecting': 'Connecting to table {code}…',
  'waitHost': "Waiting for the host's phone. Make sure the app is open on it.",
  'backHome': 'Back to the home screen',
  'offline.p2p': "No connection to the host's phone. Reconnecting… If it doesn't come back soon, the table will close.",
  'offline.server': 'No connection to the local server. Check that your phone is on the same Wi-Fi network. The game will continue when the connection returns.',
  'offline.net': 'No internet connection. The game will continue when the connection returns.',
  'test.tabs': 'Test mode: no connection to a server, so all the "phones" must be tabs in the same browser.',
  'test.home': 'Test mode: not connected to a server yet. You can try it with several tabs in the same browser.',

  'band.code': 'Table code',
  'band.rules': 'Rules',
  'band.menu': 'Menu',

  'home.band': 'Havana · 1958',
  'home.sub': 'A companion app for Mafia de Cuba: the box, the diamonds and the tokens move through the phones. The interrogation stays around the table.',
  'home.closedTitle': 'The table was closed',
  'home.closedText': 'The host closed the table or disconnected, and that is the end of the game. You can open a new table or join another.',
  'field.name': 'Your name',
  'field.namePh': 'e.g. Don Alessandro',
  'home.join': 'Join a table',
  'home.joinBtn': 'Join',
  'home.or': 'or',
  'home.create': 'Open a new table',
  'home.disclaimer': 'Unofficial app, not affiliated with Lui-même. A copy of the game Mafia de Cuba is required.',
  'toast.needName': 'You need a name to sit at the table',
  'toast.createFail': 'Could not open a table. Check your connection.',
  'toast.createRetry': 'Could not open a table. Try again.',
  'toast.code4': 'The code is 4 digits',

  'out.joining': 'Joining the table…',
  'out.sit': 'Sit at the table',
  'out.started': 'The round has already started',
  'out.startedText': 'You will join automatically in the next round, when the host sends everyone back to the lobby.',

  'tag.godfather': 'Godfather',
  'tag.host': 'Host',
  'aria.setGf': 'Make Godfather',
  'aria.kick': 'Remove from the table',
  'aria.drag': 'Drag to change seat (or use the arrow keys)',
  'lobby.table': 'Table {code}',
  'lobby.round': ' · Round {n}',
  'lobby.count': (p) => `${p.n} ${one(p.n, 'player', 'players')} at the table`,
  'lobby.qr': 'QR code to join',
  'lobby.scan': 'Scan with your camera, or open the app and type the code <b class="num">{code}</b>.',
  'lobby.copy': 'Copy link',
  'lobby.hostPhone': 'Your phone holds the table. Keep the app open until the end of the evening.',
  'lobby.seats': 'Seating',
  'lobby.seatsHost': "Arrange them to match the real seating, clockwise. The box is passed in this order, starting with the player after the Godfather.",
  'lobby.seatsGuest': 'The host arranges the seats to match the seating and picks the Godfather.',
  'lobby.settings': 'Settings',
  'lobby.cleaner': 'Play with the Cleaner',
  'lobby.cleanerHint': '(not recommended for the first games)',
  'lobby.whiskey': "Godfather's whiskey",
  'lobby.whiskeyHint': '(no whiskey in a 5-player game)',
  'aria.less': 'Less',
  'aria.more': 'More',
  'lobby.inBox': 'The box will contain',
  'lobby.diamonds15': '15 diamonds',
  'lobby.five': 'A 5-player game is harder and not recommended for a first game.',
  'lobby.start': 'Start round · {name} is the Godfather',
  'lobby.need': (p) => `Waiting for at least ${p.n} more ${one(p.n, 'player', 'players')}`,
  'lobby.waitHost': 'Waiting for {name} to start the round.',
  'chip.agentEither': 'FBI or CIA Agent',
  'chip.agentNote': 'Which agent goes into the box is decided by a random draw.',

  'setup.preparing': '{name} is preparing the box',
  'setup.preparingText': 'The Godfather hides between 0 and 5 diamonds in his pocket. The box will start moving in a moment.',
  'boxOrder': 'Box order',
  'setup.youGf': 'You are the Godfather',
  'setup.howMany': 'How many diamonds will you hide in your pocket?',
  'setup.nobody': "Nobody knows how many you hid, so the thieves can't work out exactly how many are missing.",
  'setup.stay': (p) => `${p.n} ${one(p.n, 'diamond', 'diamonds')} will stay in the box`,
  'setup.close': 'Close the box and send it to {name}',

  'seat.box': 'Has the box',
  'seat.passed': 'Passed',
  'seat.whiskey': '{n} whiskey',
  'seat.out': 'Out',
  'seat.you': ' (you)',
  'pocket.gf': 'In your pocket: <b class="num">{n}</b> diamonds you hid. {goal}',
  'pocket.hold': 'Hold to see what is in your pocket',
  'pocket.title': 'My pocket',
  'pocket.peek': 'Hold your finger down to peek. Watch your neighbors.',
  'pocket.whiskey': '{n} whiskey from the Godfather',
  'pocket.thiefN': (p) => ` · <span class="num">${p.n}</span> ${one(p.n, 'diamond', 'diamonds')}`,

  'theft.next': "You're next.",
  'theft.ahead': (p) => `${p.n} more ${one(p.n, 'player', 'players')} before you.`,
  'theft.eyebrow': 'The diamond heist',
  'theft.boxWith': 'The box is with {name}',
  'theft.yourTurn': 'Your turn · {n} of {total}',
  'box.label': "The Godfather's box",
  'box.yours': 'The box is with you',
  'box.hide': 'Hide your screen from your neighbors, then open it.',
  'box.open': 'Open the box',
  'box.tokens': 'Tokens in the box',
  'box.remember': "Remember what you saw: later you'll have to testify, or lie convincingly.",
  'box.emptyTitle': 'The box is empty. You are a street urchin.',
  'box.emptyText': 'Pretend to take something, and pass it on.',
  'box.pretended': 'I pretended. Pass it on',
  'bag.title': 'The bag: first player only',
  'bag.text': 'You may hide one token in the bag until the end of the game. Nobody will know which. Then take as usual.',
  'bag.none': 'Hide nothing',
  'take.choose': 'Choose what to take',
  'take.diamonds': (p) => `Take ${p.n} ${one(p.n, 'diamond', 'diamonds')} and pass`,
  'take.token': 'Take {token} and pass',
  'take.nothing': 'Take nothing and pass',
  'take.title': 'What do you take? You must take something',
  'take.diamondsBtn': 'Diamonds (at least one)',
  'take.howMany': 'How many diamonds to take',
  'take.orToken': 'Or one token:',
  'take.urchinBtn': 'Take nothing (street urchin)',
  'take.urchinNote': "You're last, so you may take nothing. Just pretend you did.",
  'take.passTo': 'The box will pass to {name}',
  'take.passToGf': 'The box will pass to the Godfather',

  'inv.diamondsBack': 'diamonds recovered',
  'inv.whiskeyGf': 'whiskey for the Godfather',
  'inv.outCount': 'out',
  'inv.log': 'What happened so far',
  'inv.cleared': 'Cleared',
  'inv.accuse': 'Accuse',
  'inv.eyebrowGf': 'The investigation · You are the Godfather',
  'inv.stolen': 'Stolen',
  'inv.recovered': 'Recovered',
  'inv.whiskey': 'Whiskey',
  'inv.cameBack': 'What came back in the box',
  'inv.hid': 'You hid {n} in your pocket. There were 15 at the start.',
  'inv.investigate': 'Investigate, then accuse',
  'inv.investigateText': 'Ask out loud, at the table. When you are sure, press "Accuse" to shout "Empty your pockets!".',
  'inv.goodQ': 'Good questions to ask',
  'inv.q1': 'When you got the box, how many diamonds were in it?',
  'inv.q2': 'Which tokens were in it?',
  'inv.q3': 'What did you leave when you passed it on?',
  'inv.q4': 'What did you take?',
  'inv.q5': 'Who sat before you, and what did they say was in the box?',
  'inv.youOut': 'You are out',
  'inv.youOutText': 'From now on you may not speak or take part in the investigation.',
  'inv.eyebrow': 'The investigation',
  'inv.investigating': '{name} is investigating',
  'inv.answer': 'Answer out loud. You may lie, exaggerate, stay silent or twist what others said.',
  'inv.atTable': 'At the table',

  'log.thief': (p) => `${p.who} was caught with ${p.n} ${one(p.n, 'diamond', 'diamonds')} and knocked out.`,
  'log.innocentUrchin': '{who} was accused, but has empty pockets. Got a whiskey.',
  'log.innocentRole': '{who} was accused, but turned out to be {role}. Got a whiskey.',
  'log.agent': '{who} is {role}.',
  'log.godfatherOut': '{who} is clean, and the Godfather ran out of whiskey.',
  'log.powThief': (p) => `a thief, ${p.n} ${one(p.n, 'diamond', 'diamonds')} came back`,
  'log.powUrchin': 'empty pockets',
  'log.pow': 'POW! {by} shot {who} ({what}). Both are out.',
  'log.powAgent': 'POW! {by} took out {who}, {role}.',

  'end.gf1': 'The Godfather got back all the diamonds', 'end.gf2': 'The Godfather, the Loyal Henchmen and the Cleaner win.',
  'end.agent1': 'The Godfather accused an agent', 'end.agent2': 'The agent wins alone.',
  'end.cleaner1': 'POW! The Cleaner took out an agent', 'end.cleaner2': 'The Cleaner wins alone.',
  'end.thieves1': 'The Godfather is out',
  'end.thieves2': 'The thief with the most diamonds wins, along with the street urchins.',
  'end.thieves2none': 'No thief is left in the game, so no thief wins.',
  'end.over': 'The round is over',
  'end.nobody': 'Nobody',
  'end.hid': 'Hid {n}',
  'end.won': 'Won',
  'end.eyebrow': 'End of round',
  'end.youWon': 'You won!',
  'end.youLost': "You didn't win this time",
  'end.winners': 'Winners: {names}',
  'end.whatEach': 'What everyone had',
  'end.bag': (p) => `In the bag: ${p.bag} · ${p.n} ${one(p.n, 'diamond', 'diamonds')} left in the box`,
  'end.bagNone': 'Nothing',
  'end.investigation': 'The investigation',
  'end.newRound': 'New round',
  'end.newRoundText': 'The winners pick the next Godfather. You can also swap seats in the lobby.',
  'end.nextGf': 'Next Godfather',
  'end.wonSuffix': ' (won)',
  'end.backLobby': 'Back to the lobby',
  'end.hostNew': '{name} will start a new round.',
  'nDiamonds': (p) => `${p.n} ${one(p.n, 'diamond', 'diamonds')}`,

  'acc.costJokers': "If he isn't a thief, you'll have to give him a whiskey ({n} left). If he's an agent, you lose.",
  'acc.costNone': "You have no whiskey left: if he isn't a thief, you are out. If he's an agent, you lose.",
  'acc.cry': 'Empty your pockets!',
  'acc.notYet': 'Not yet',
  'acc.accuses': '{name} accuses',
  'acc.you': 'You!',
  'acc.pow': 'POW!',
  'acc.powNote': 'You have one moment before the pockets are emptied.',
  'rev.emptying': 'Emptying the pockets…',
  'rev.thiefV': (p) => `Thief! ${p.n} ${one(p.n, 'diamond', 'diamonds')}`,
  'rev.thiefSub': (p) => `${p.who} is out. The ${one(p.n, 'diamond', 'diamonds')} went back to the Godfather.`,
  'rev.emptyPockets': 'Empty pockets',
  'rev.whoIs': '{who} is {role}',
  'rev.innocentSub': 'The Godfather was wrong and gives {who} a whiskey. {n} left.',
  'rev.agentV': '{role}!',
  'rev.agentSub': '{who} was an undercover agent. The agent wins.',
  'rev.gfOutV': 'The Godfather is out',
  'rev.gfOutPockets': '{who} has empty pockets, and the Godfather has no whiskey left.',
  'rev.gfOutRole': '{who} is {role}, and the Godfather has no whiskey left.',
  'rev.powThief': (p) => `, who was a thief with ${p.n} ${one(p.n, 'diamond', 'diamonds')}. The ${one(p.n, 'diamond', 'diamonds')} went back to the Godfather`,
  'rev.powOther': ', who was {role}',
  'rev.powUrchin': 'a street urchin',
  'rev.powSub': '{by} shot {who}{what}. Both are out.',
  'rev.powAgentV': 'POW! Agent taken out',
  'rev.powAgentSub': '{by} is the Cleaner, and {who} was {role}. The Cleaner wins alone.',
  'rev.continue': 'Continue',

  'menu.title': 'Menu',
  'menu.chatTtl': 'Chat message lifetime (seconds)',
  'menu.chatCd': 'Delay between messages from the same player (seconds, 0 = no limit)',
  'menu.save': 'Save',
  'menu.abort': 'Cancel the round and return to the lobby',
  'menu.hostNote': 'You are the host: your phone holds the table. If you close it, the game ends for everyone.',
  'menu.closeTable': 'Close the table for everyone',
  'menu.leave': 'Leave the table',
  'menu.close': 'Close',
  'toast.needName2': 'A name is required',
  'menu.ttlLabel': 'The message lifetime',
  'menu.cdLabel': 'The delay between messages',
  'menu.range': '{label} must be between {min} and {max} seconds',
  'toast.saved': 'Saved',
  'toast.linkCopied': 'Link copied',

  'rules.aria': 'Rules',
  'rules.title': 'How to play',
  'rules.ok': 'Got it',
  'rules.html': `<p>A bluffing game for 6 to 12 players. The phone only replaces the box, the diamonds and the tokens. Everything else happens out loud around the table.</p>
    <h3>1. Setup</h3>
    <ul><li>The Godfather hides between 0 and 5 of the 15 diamonds in his pocket.</li><li>The box also holds character tokens, depending on the number of players.</li></ul>
    <h3>2. Stealing the diamonds</h3>
    <ul>
      <li>The box is passed clockwise, starting with the player to the Godfather's left.</li>
      <li>Each player looks in secret, remembers what they saw, and takes <b>at least one diamond</b> or <b>one token</b>. Taking nothing is not allowed.</li>
      <li>The first player may first hide one token in the bag, until the end of the game.</li>
      <li>Whoever receives an empty box becomes a street urchin and pretends to take something.</li>
      <li>The last player may choose to take nothing and be a street urchin.</li>
    </ul>
    <h3>3. The investigation</h3>
    <ul>
      <li>The Godfather questions whoever he wants, in any order. Lying, staying silent and twisting the truth are all allowed.</li>
      <li>When he is sure, he accuses: "Empty your pockets!".</li>
      <li><b>Thief:</b> the diamonds go back to the Godfather, and the thief is out and may not speak.</li>
      <li><b>Not a thief:</b> the Godfather gives them a whiskey. If the Godfather runs out of whiskey, the Godfather is out.</li>
      <li><b>FBI or CIA agent:</b> the game ends and the agent wins.</li>
    </ul>
    <h3>Who wins</h3>
    <ul>
      <li><b>The Godfather and the Loyal Henchmen:</b> if the Godfather got back all the diamonds.</li>
      <li><b>Agent:</b> if the Godfather accused them. They win alone.</li>
      <li><b>Thief:</b> if the Godfather is out, the thief still in the game with the most diamonds wins. On a tie, they all win.</li>
      <li><b>Street urchin:</b> if a thief wins.</li>
      <li><b>Driver:</b> if the player to their right wins.</li>
      <li><b>The Cleaner (optional):</b> on the Godfather's side. When the Godfather accuses, they can shout POW! before the reveal. Against an agent they win alone. Against anyone else, both are out: a thief returns the diamonds, and a non-thief gets no whiskey.</li>
    </ul>
    <h3>Playing with phones</h3>
    <ul><li>The host opens a table, and everyone joins with the code or the QR code.</li><li>Arrange the seats in the lobby to match the real seating.</li><li>"My pocket": hold your finger down to peek at what you took.</li></ul>`,

  'chat.title': 'Chat',
  'chat.close': 'Close chat',
  'chat.placeholder': 'Message…',
  'chat.messageAria': 'Message',
  'chat.send': 'Send',
  'chat.empty': 'No messages',
  'chat.note': 'Messages disappear after {ttl}.',
  'chat.noteRate': ' You can send a message every {cd}.',
  'dur.second': '1 second',
  'dur.minute': '1 minute',
  'dur.minutes': '{n} minutes',
  'dur.seconds': '{n} seconds',
};

const DICT = { he, en };

// Hebrew error messages produced by game.js, sync.js and the local server, as shown to an English reader.
// Keys must match the source strings exactly (test/i18n.test.mjs checks that every message in the code has an entry).
export const ERR_EN = {
  'השולחן לא קיים': 'The table does not exist',
  'המשחק כבר התחיל. חכו לסיבוב הבא.': 'The game has already started. Wait for the next round.',
  'השולחן מלא (12 שחקנים)': 'The table is full (12 players)',
  'אתה לא בשולחן': "You're not at the table",
  'רק המארח יכול להוציא שחקנים': 'Only the host can remove players',
  'אפשר להוציא שחקנים רק בין סיבובים': 'Players can only be removed between rounds',
  'המארח לא יכול להוציא את עצמו': 'The host cannot remove themselves',
  'רק המארח מסדר את המקומות': 'Only the host arranges the seats',
  'אפשר לסדר מקומות רק בלובי': 'Seats can only be arranged in the lobby',
  'רק המארח בוחר סנדק': 'Only the host picks the Godfather',
  'אפשר לבחור סנדק רק בלובי': 'The Godfather can only be chosen in the lobby',
  'השחקן לא בשולחן': 'That player is not at the table',
  'רק המארח משנה הגדרות': 'Only the host can change settings',
  'אפשר לשנות הגדרות רק בלובי': 'Settings can only be changed in the lobby',
  'ההודעה ריקה': 'The message is empty',
  'חכו רגע לפני ההודעה הבאה': 'Wait a moment before the next message',
  "רק המארח משנה את הגדרות הצ'אט": 'Only the host can change the chat settings',
  'זמן לא תקין': 'Invalid time',
  'רק המארח מתחיל את המשחק': 'Only the host starts the game',
  'המשחק כבר התחיל': 'The game has already started',
  'זה לא שלב ההכנה': 'This is not the setup stage',
  'רק הסנדק מחביא יהלומים': 'Only the Godfather hides diamonds',
  'אפשר להחביא בין 0 ל־5 יהלומים': 'You can hide between 0 and 5 diamonds',
  'הקופסה לא בסיבוב': 'The box is not being passed around',
  'רק השחקן הראשון יכול להכניס טוקן לשקית': 'Only the first player can put a token in the bag',
  'כבר השתמשת בשקית': 'You already used the bag',
  'הטוקן הזה לא בקופסה': 'That token is not in the box',
  'הקופסה לא אצלך': "You don't have the box",
  'הקופסה ריקה': 'The box is empty',
  'צריך לקחת לפחות יהלום אחד': 'You must take at least one diamond',
  'אין כל כך הרבה יהלומים בקופסה': 'There are not that many diamonds in the box',
  'אסור לא לקחת כלום': 'You may not take nothing',
  'פעולה לא מוכרת': 'Unknown action',
  'זה לא שלב החקירה': 'This is not the investigation stage',
  'רק הסנדק מאשים': 'Only the Godfather accuses',
  'יש כבר האשמה פתוחה': 'There is already an open accusation',
  'אי אפשר להאשים את השחקן הזה': 'You cannot accuse this player',
  'השחקן הזה כבר הודח': 'This player is already out',
  'השחקן הזה כבר הואשם בטעות וקיבל וויסקי': 'This player was already wrongly accused and got a whiskey',
  'מאוחר מדי': 'Too late',
  'רק המנקה יכול לירות': 'Only the Cleaner can shoot',
  'הודחת': 'You are out',
  'אי אפשר לירות בעצמך': 'You cannot shoot yourself',
  'רק המארח מתחיל סיבוב חדש': 'Only the host starts a new round',
  'הסיבוב עוד לא נגמר': 'The round is not over yet',
  'רק המארח יכול לבטל סיבוב': 'Only the host can cancel a round',
  // sync.js / server/server.js / app.js
  'אין חיבור לשרת. מנסה להתחבר מחדש…': 'No connection to the server. Reconnecting…',
  'שגיאה': 'Error',
  'השרת לא ענה. נסו שוב.': 'The server did not respond. Try again.',
  'אין חיבור לטלפון של המארח. מנסה להתחבר מחדש…': "No connection to the host's phone. Reconnecting…",
  'המארח לא ענה. נסו שוב.': 'The host did not respond. Try again.',
  'אין שולחן פתוח': 'No table is open',
  'אין חיבור לשולחן. בדקו את האינטרנט ונסו שוב.': 'No connection to the table. Check your internet and try again.',
  'השולחן לא קיים יותר.': 'The table no longer exists.',
};
// Messages that carry a number (built from MIN_PLAYERS / MAX_PLAYERS in game.js).
const ERR_EN_RE = [
  [/^צריך לפחות (\d+) שחקנים$/, 'At least $1 players are needed'],
  [/^אפשר עד (\d+) שחקנים$/, 'No more than $1 players are allowed'],
];

// ---------- language state ----------
function initialLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) { try { localStorage.setItem(KEY, q); } catch {} return q; }
  } catch {}
  try { const v = localStorage.getItem(KEY); if (LANGS.includes(v)) return v; } catch {}
  return 'he';
}
let lang = initialLang();

export const getLang = () => lang;
export const dirOf = (l = lang) => (l === 'he' ? 'rtl' : 'ltr');

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch {}
  applyStatic();
}

// t('key', { n: 3 }). Unknown keys fall back to Hebrew, then to the key itself, so a missing English string never
// breaks the screen.
export function t(key, p) {
  const v = DICT[lang][key] ?? DICT.he[key] ?? key;
  if (typeof v === 'function') return v(p || {});
  return v.replace(/\{(\w+)\}/g, (_, k) => (p && p[k] != null ? p[k] : ''));
}

// Translate an error message that came from the game logic or the connection (always Hebrew at the source).
export function tErr(msg) {
  if (lang === 'he') return msg;
  if (Object.prototype.hasOwnProperty.call(ERR_EN, msg)) return ERR_EN[msg];
  for (const [re, out] of ERR_EN_RE) if (re.test(msg)) return msg.replace(re, out);
  return msg;
}

// <html lang/dir>, the document title, and the static strings in index.html (data-i18n, data-i18n-aria, data-i18n-ph).
export function applyStatic() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = lang; root.dir = dirOf();
  document.title = t('app.title');
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => n.setAttribute('placeholder', t(n.dataset.i18nPh)));
}

export const _dicts = { he, en }; // for tests

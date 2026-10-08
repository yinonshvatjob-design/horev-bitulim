const fs = require('fs');
const path = require('path');

const ALL_COORDINATORS = [
  { id: "025181975", name: "אברהם ליפשיץ", email: "avilif2@gmail.com" },
  { id: "316097542", name: "אורי מאיר קרוק", email: "ori.kruk.7@gmail.com" },
  { id: "058265687", name: "אורלי דברי", email: "orlydevary@gmail.com" },
  { id: "206147621", name: "אלחנן חיים יגודה", email: "8441985@gmail.com" },
  { id: "036029577", name: "אסתר סופר", email: "jkstso@gmail.com" },
  { id: "003749561", name: "ד\"ר זאב פרידמן", email: "frzeev@gmail.com" },
  { id: "057756868", name: "ד\"ר צבי אריכא", email: "zvikaarica@gmail.com" },
  { id: "318925278", name: "דולב סופר", email: "dolevsss2@gmail.com" },
  { id: "206673832", name: "הילל יהונתן ביבי", email: "hilelbibi@gmail.com" },
  { id: "200545432", name: "הרב א. קירשנבוים", email: "assafhorev@gmail.com" },
  { id: "055707087", name: "הרב אבנר ששר", email: "sasar10@walla.com" },
  { id: "059805002", name: "הרב אברהם שטיינר", email: "maleip@gmail.com" },
  { id: "021395694", name: "הרב אוהד אהרנפלד", email: "ohadhadasa@gmail.com" },
  { id: "033226523", name: "הרב אהרן כהן", email: "ravitroni5@gmail.com" },
  { id: "025018417", name: "הרב אושרי ברוך", email: "oshrib547@gmail.com" },
  { id: "029517455", name: "הרב איתי נגיד", email: "naitay@walla.com" },
  { id: "303184477", name: "הרב איתמר צדק", email: "zedek_i@walla.com" },
  { id: "038707311", name: "הרב אליהו י. שינפלד", email: "elidid@gmail.com" },
  { id: "038757514", name: "הרב אליקים קובץ'", email: "elikovacs@gmail.com" },
  { id: "060936481", name: "הרב אלעד ירדני", email: "nahumy7@gmail.com" },
  { id: "056771736", name: "הרב אמציה לוי", email: "amatzya61@gmail.com" },
  { id: "029524535", name: "הרב גואל אהרוני", email: "goelbendavid@gmail.com" },
  { id: "057654667", name: "הרב דוד ליבוביץ", email: "dudilei@gmail.com" },
  { id: "058031337", name: "הרב דוד מ. מוריה", email: "davidmoriah@gmail.com" },
  { id: "028074342", name: "הרב דורון עקיבא", email: "doro999@gmail.com" },
  { id: "058028341", name: "הרב חגי קלמנוביץ", email: "chagi6@walla.co.il" },
  { id: "023642846", name: "הרב חיים מורביה", email: "hmor10@walla.co.il" },
  { id: "036194520", name: "הרב חן זהבי", email: "123chen1@gmail.com" },
  { id: "024453094", name: "הרב יאיר שינקולבסקי", email: "Yairshe11@gmail.com" },
  { id: "201430485", name: "הרב יהודה אוחנה", email: "yehudam801@gmail.com" },
  { id: "055560379", name: "הרב יוסי אליאב", email: "eliavfam@walla.com" },
  { id: "203084637", name: "הרב ינון שבט", email: "yinonshvatjob@gmail.com" },
  { id: "025630633", name: "הרב יעקב הכט", email: "hectyac@gmail.com" },
  { id: "037145182", name: "הרב יעקב כהן", email: "yakovchn@gmail.com" },
  { id: "057332009", name: "הרב יצחק דור", email: "ydor@horev.org.il" },
  { id: "054856364", name: "הרב יצחק שטיינר", email: "iziksteiner@gmail.com" },
  { id: "015389414", name: "הרב ירוחם שמשוביץ", email: "yeroham.simsovic@gmail.com" },
  { id: "040119331", name: "הרב מיכאל קליין", email: "mklain80@gmail.com" },
  { id: "028618627", name: "הרב מרדכי ד. כהן", email: "Motkecohen6@gmail.com" },
  { id: "012763819", name: "הרב משה טרשנסקי", email: "horevmoshe@gmail.com" },
  { id: "059641555", name: "הרב נחמיה י. כהן", email: "mnkohen@gmail.com" },
  { id: "313368367", name: "הרב נריה חסיד", email: "neriyahas@gmail.com" },
  { id: "204070197", name: "הרב נריה נמיר", email: "nreya56@gmail.com" },
  { id: "066385527", name: "הרב נריה פיינגולד", email: "neriyafg@gmail.com" },
  { id: "033963430", name: "הרב נתן אורבך", email: "natanaue@gmail.com" },
  { id: "205785710", name: "הרב נתנאל מסינג", email: "netanelmessing@gmail.com" },
  { id: "058281403", name: "הרב עופר י. טויבר", email: "ofertb@gmail.com" },
  { id: "312173628", name: "הרב עמית מסילתי", email: "amitmesi9@gmail.com" },
  { id: "040975641", name: "הרב צביקה בולבין", email: "zb0527155206@gmail.com" },
  { id: "033212911", name: "הרב צביקה דנטלסקי", email: "zviden0@gmail.com" },
  { id: "029702511", name: "הרב ציון אבירם", email: "zionaviram@gmail.com" },
  { id: "066171638", name: "הרב קובי פיג'ו", email: "kmpecho@gmail.com" },
  { id: "025352881", name: "הרב רון קורש", email: "koreshhorev@gmail.com" },
  { id: "028536654", name: "הרב שלמה שלוסברג", email: "s.shlosberg@gmail.com" },
  { id: "200989911", name: "הרב שלמה שרים", email: "shlomishrem7@gmail.com" },
  { id: "037670692", name: "הרב שמואל גרינברג", email: "mbibeg@gmail.com" },
  { id: "036616530", name: "חדוה לב", email: "chlev6000@gmail.com" },
  { id: "204643563", name: "חיים יצחק רובין", email: "hy.rubin@gmail.com" },
  { id: "037696036", name: "חיים סופר", email: "hsofer@gmail.com" },
  { id: "013895537", name: "חנה מגורי", email: "channah.magori@gmail.com" },
  { id: "034741538", name: "סוכמן אורי אברהם", email: "orituchman85@gmail.com" },
  { id: "033664087", name: "טל עזריאל", email: "taliozeri100@gmail.com" },
  { id: "315249722", name: "יאיר זכריה", email: "yzach@gmail.com" },
  { id: "302737580", name: "יוסף קליין", email: "josefklein@gmail.com" },
  { id: "012345678", name: "ישיבת חורב", email: "y-info@yeshiva.horev.org.il" },
  { id: "012259222", name: "ישעיהו פורסטנברג", email: "yeshayahuf@gmail.com" },
  { id: "028635092", name: "מוטי שוחטמן", email: "motis@horev.org.il" },
  { id: "051987691", name: "מלכה אסנת גלד", email: "osnatbag@hotmail.com" },
  { id: "308122787", name: "מנשה רחמים ישראל בוהרון", email: "menashebo@gmail.com" },
  { id: "023809999", name: "מר אליהו אביטל", email: "eli.avital999@gmail.com" },
  { id: "021982780", name: "מר ברוך צבי טלר", email: "baruchteller@gmail.com" }
];

// 1. Update database.json
const dbPath = path.join(__dirname, '..', 'database.json');
if (fs.existsSync(dbPath)) {
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  dbData.coordinators = ALL_COORDINATORS;
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log('Successfully updated database.json with', ALL_COORDINATORS.length, 'coordinators');
}

// 2. Update db.js SEED_COORDINATORS
const dbJsPath = path.join(__dirname, '..', 'db.js');
let dbJsContent = fs.readFileSync(dbJsPath, 'utf8');

const seedString = `const SEED_COORDINATORS = ${JSON.stringify(ALL_COORDINATORS, null, 2)};`;
dbJsContent = dbJsContent.replace(/const SEED_COORDINATORS = \[[\s\S]*?\];/m, seedString);
fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');
console.log('Successfully updated db.js with', ALL_COORDINATORS.length, 'coordinators');

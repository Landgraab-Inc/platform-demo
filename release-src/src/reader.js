const READER_DATA = (() => {
const scenes = [
{title:'Ночь. Половина третьего',subtitle:'Eine Küche. Zwei Menschen. Ein Geheimnis.',paragraphs:[
`Plötzlich wachte sie auf. Es war halb drei. Sie überlegte, warum sie aufgewacht war. Ach so! In der Küche hatte jemand gegen einen Stuhl gestoßen. Sie horchte nach der Küche. Es war still. Es war zu still und als sie mit der Hand über das Bett neben sich fuhr, fand sie es leer. Das war es, was es so besonders still gemacht hatte: sein Atem fehlte. Sie stand auf und tappte durch die dunkle Wohnung zur Küche. In der Küche trafen sie sich. Die Uhr war halb drei. Sie sah etwas Weißes am Küchenschrank stehen.`,
`Sie machte Licht. Sie standen sich im Hemd gegenüber. Nachts. Um halb drei. In der Küche.`,
`Auf dem Küchentisch stand der Brotteller. Sie sah, dass er sich Brot abgeschnitten hatte. Das Messer lag noch neben dem Teller. Und auf der Decke lagen Brotkrümel. Wenn sie abends zu Bett gingen, machte sie immer das Tischtuch sauber. Jeden Abend. Aber nun lagen Krümel auf dem Tuch. Und das Messer lag da. Sie fühlte, wie die Kälte der Fliesen langsam an ihr hoch kroch. Und sie sah von dem Teller weg.`]},
{title:'То, о чём не говорят',subtitle:'„Ich dachte, hier wäre was.“',paragraphs:[
`„Ich dachte, hier wäre was“, sagte er und sah in der Küche umher.`,
`„Ich habe auch was gehört“, antwortete sie, und dabei fand sie, dass er nachts im Hemd doch schon recht alt aussah. So alt wie er war. Dreiundsechzig. Tagsüber sah er manchmal jünger aus. Sie sieht doch schon alt aus, dachte er, im Hemd sieht sie doch ziemlich alt aus. Aber das liegt vielleicht an den Haaren. Bei den Frauen liegt das nachts immer an den Haaren. Die machen dann auf einmal so alt.`,
`„Du hättest Schuhe anziehen sollen. So barfuß auf den kalten Fliesen. Du erkältest dich noch.“`,
`Sie sah ihn nicht an, weil sie nicht ertragen konnte, dass er log. Dass er log, nachdem sie neununddreißig Jahre verheiratet waren.`,
`„Ich dachte, hier wäre was“, sagte er noch einmal und sah wieder so sinnlos von einer Ecke in die andere, „ich hörte hier was. Da dachte ich, hier wäre was.“`,
`„Ich hab auch was gehört. Aber es war wohl nichts.“ Sie stellte den Teller vom Tisch und schnippte die Krümel von der Decke.`,
`„Nein, es war wohl nichts“, echote er unsicher.`]},
{title:'Вернуться в темноту',subtitle:'Die Wahrheit bleibt unausgesprochen.',paragraphs:[
`Sie kam ihm zu Hilfe: „Komm man. Das war wohl draußen. Komm man zu Bett. Du erkältest dich noch. Auf den kalten Fliesen.“`,
`Er sah zum Fenster hin. „Ja, das muss wohl draußen gewesen sein. Ich dachte, es wäre hier.“`,
`Sie hob die Hand zum Lichtschalter. Ich muss das Licht jetzt ausmachen, sonst muss ich nach dem Teller sehen, dachte sie. Ich darf doch nicht nach dem Teller sehen. „Komm man“, sagte sie und machte das Licht aus, „das war wohl draußen. Die Dachrinne schlägt immer bei Wind gegen die Wand. Es war sicher die Dachrinne. Bei Wind klappert sie immer.“`,
`Sie tappten sich beide über den dunklen Korridor zum Schlafzimmer. Ihre nackten Füße platschten auf den Fußboden.`,
`„Wind ist ja“, meinte er. „Wind war schon die ganze Nacht.“ Als sie im Bett lagen, sagte sie: „Ja, Wind war schon die ganze Nacht. Es war wohl die Dachrinne.“`,
`„Ja, ich dachte, es wäre in der Küche. Es war wohl die Dachrinne.“ Er sagte das, als ob er schon halb im Schlaf wäre.`]},
{title:'Тишина между ними',subtitle:'Manchmal hört man mehr, als jemand sagt.',paragraphs:[
`Aber sie merkte, wie unecht seine Stimme klang, wenn er log.`,
`„Es ist kalt“, sagte sie und gähnte leise, „ich krieche unter die Decke. Gute Nacht.“`,
`„Nacht“, antwortete er noch: „ja, kalt ist es schon ganz schön.“`,
`Dann war es still. Nach vielen Minuten hörte sie, dass er leise und vorsichtig kaute. Sie atmete absichtlich tief und gleichmäßig, damit er nicht merken sollte, dass sie noch wach war. Aber sein Kauen war so regelmäßig, dass sie davon langsam einschlief.`]},
{title:'Ещё один ломтик',subtitle:'Eine kleine Geste. Eine große Geschichte.',paragraphs:[
`Als er am nächsten Abend nach Hause kam, schob sie ihm vier Scheiben Brot hin. Sonst hatte er immer nur drei essen können.`,
`„Du kannst ruhig vier essen“, sagte sie und ging von der Lampe weg. „Ich kann dieses Brot nicht so recht vertragen. Iss doch man eine mehr. Ich vertrag es nicht so gut.“`,
`Sie sah, wie er sich tief über den Teller beugte. Er sah nicht auf. In diesem Augenblick tat er ihr leid.`,
`„Du kannst doch nicht nur zwei Scheiben essen“, sagte er auf seinen Teller.`,
`„Doch. Abends vertrag ich das Brot nicht gut. Iss man. Iss man.“`,
`Erst nach einer Weile setzte sie sich unter die Lampe an den Tisch.`]}];
// Авторские редакторские подсказки. Форма токена уточняется в occurrenceInfo.
const lex={};
function entries(lines,type){lines.trim().split('\n').forEach(line=>{let [forms,lemma,ru,info,example,exru,level,id]=line.split('|');forms.split(',').forEach(f=>lex[f.toLowerCase()]={lemma,ru,type,info,example,exru,level:level||'Поддержка',id:id||''});});}
entries(`
Brot|das Brot|хлеб|Средний род · ед. ч.; мн. die Brote|Ich kaufe frisches Brot.|Я покупаю свежий хлеб.|A1 · повторение|LX-0011
Küche|die Küche|кухня|Женский род · ед. ч.; мн. die Küchen|Wir essen in der Küche.|Мы едим на кухне.|A1 · повторение|LX-0224
Stuhl|der Stuhl|стул|Мужской род · ед. ч.; мн. die Stühle|Der Stuhl steht am Tisch.|Стул стоит у стола.|A2|LX-1456
Hand|die Hand|рука, кисть|Женский род · ед. ч.; мн. die Hände|Sie nimmt meine Hand.|Она берёт меня за руку.|A1 · повторение|LX-0590
Bett|das Bett|кровать|Средний род · ед. ч.; мн. die Betten|Ich liege im Bett.|Я лежу в кровати.|A1 · повторение|LX-0227
Atem|der Atem|дыхание|Мужской род · ед. ч.; обычно без мн. ч.|Ich höre seinen Atem.|Я слышу его дыхание.
Wohnung|die Wohnung|квартира|Женский род · ед. ч.; мн. die Wohnungen|Unsere Wohnung ist klein.|Наша квартира маленькая.|A1 · повторение|LX-0034
Uhr|die Uhr|часы|Женский род · ед. ч.; мн. die Uhren|Die Uhr ist kaputt.|Часы сломаны.
Weißes|etwas Weißes|что-то белое|Субстантивированное прилагательное · ср. род · Akkusativ после sah|Ich sehe etwas Weißes.|Я вижу что-то белое.
Küchenschrank|der Küchenschrank|кухонный шкаф|Мужской род · ед. ч.; мн. die Küchenschränke|Die Teller sind im Küchenschrank.|Тарелки в кухонном шкафу.
Hemd|das Hemd|рубашка|Средний род · ед. ч.; мн. die Hemden|Er trägt ein weißes Hemd.|Он носит белую рубашку.|A2|LX-1194
Küchentisch|der Küchentisch|кухонный стол|Мужской род · ед. ч.; мн. die Küchentische|Wir sitzen am Küchentisch.|Мы сидим за кухонным столом.
Brotteller|der Brotteller|тарелка для хлеба|Мужской род · ед. ч.; мн. die Brotteller|Das Brot liegt auf dem Brotteller.|Хлеб лежит на тарелке для хлеба.
Messer|das Messer|нож|Средний род · ед. ч.; мн. die Messer|Das Messer liegt neben dem Teller.|Нож лежит рядом с тарелкой.|A2|LX-1282
Teller|der Teller|тарелка|Мужской род · ед. ч.; мн. die Teller|Ich stelle den Teller auf den Tisch.|Я ставлю тарелку на стол.|A2|LX-1472
Decke|die Decke|скатерть; одеяло|Женский род · ед. ч.; мн. die Decken. На столе — скатерть; в постели — одеяло.|Ich schlafe unter einer warmen Decke.|Я сплю под тёплым одеялом.
Brotkrümel,Krümel|der Krümel|хлебная крошка|Мужской род · здесь мн. ч.; die (Brot)krümel|Auf dem Tisch liegen Krümel.|На столе лежат крошки.
Tischtuch,Tuch|das Tischtuch|скатерть|Средний род · ед. ч.; мн. die Tischtücher. Tuch: ткань, здесь скатерть.|Das Tischtuch ist sauber.|Скатерть чистая.
Abend|der Abend|вечер|Мужской род · ед. ч.; мн. die Abende|Am Abend lese ich.|Вечером я читаю.|A1 · повторение|LX-0838
Kälte|die Kälte|холод|Женский род · ед. ч.; без обычного мн. ч.|Ich mag die Kälte nicht.|Я не люблю холод.
Fliesen|die Fliese|плитка|Женский род · здесь мн. ч.; die Fliesen|Die Fliesen sind kalt.|Плитка холодная.
Haaren|das Haar|волос|Средний род · Dativ мн. ч.; die Haare → den Haaren|Das liegt an den Haaren.|Дело в волосах.
Frauen|die Frau|женщина|Женский род · здесь мн. ч.; die Frauen|Die Frauen sprechen miteinander.|Женщины разговаривают друг с другом.
Schuhe|der Schuh|обувь, туфли|Мужской род · Akkusativ мн. ч.; die Schuhe|Ich ziehe meine Schuhe an.|Я надеваю обувь.|A1 · повторение|LX-0663
Jahre|das Jahr|год|Средний род · здесь мн. ч.; die Jahre|Wir sind seit zehn Jahren verheiratet.|Мы женаты десять лет.
Ecke|die Ecke|угол|Женский род · ед. ч.; мн. die Ecken|Der Stuhl steht in der Ecke.|Стул стоит в углу.
Tisch|der Tisch|стол|Мужской род · ед. ч.; мн. die Tische|Wir sitzen am Tisch.|Мы сидим за столом.
Hilfe|die Hilfe|помощь|Женский род · ед. ч.; zu Hilfe kommen — прийти на помощь|Danke für deine Hilfe.|Спасибо за твою помощь.
Fenster|das Fenster|окно|Средний род · ед. ч.; мн. die Fenster|Ich öffne das Fenster.|Я открываю окно.|A2|LX-1135
Licht,Lichtschalter|das Licht / der Lichtschalter|свет / выключатель|Licht: ср. род; Lichtschalter: муж. род · ед. ч.|Ich mache das Licht aus.|Я выключаю свет.|A1 · повторение|LX-0606
Dachrinne|die Dachrinne|водосточный жёлоб|Женский род · ед. ч.; мн. die Dachrinnen|Die Dachrinne klappert im Wind.|Водосточный жёлоб гремит на ветру.
Wind|der Wind|ветер|Мужской род · ед. ч.; мн. die Winde|Heute ist es windig.|Сегодня ветрено.|A1 · повторение|LX-0761
Wand|die Wand|стена|Женский род · ед. ч.; мн. die Wände|Das Bild hängt an der Wand.|Картина висит на стене.|Поддержка · в реестре B1|LX-3316
Korridor|der Korridor|коридор|Мужской род · ед. ч.; мн. die Korridore|Der Korridor ist dunkel.|Коридор тёмный.
Schlafzimmer|das Schlafzimmer|спальня|Средний род · ед. ч.; мн. die Schlafzimmer|Das Bett steht im Schlafzimmer.|Кровать стоит в спальне.
Füße|der Fuß|ступня, нога|Мужской род · Nominativ мн. ч.; die Füße|Meine Füße sind kalt.|У меня холодные ноги.
Fußboden|der Fußboden|пол|Мужской род · ед. ч.; мн. die Fußböden|Der Fußboden ist kalt.|Пол холодный.
Nacht|die Nacht|ночь|Женский род · ед. ч.; мн. die Nächte|Gute Nacht!|Спокойной ночи!|A1 · повторение|LX-0839
Schlaf|der Schlaf|сон|Мужской род · ед. ч.; обычно без мн. ч.|Ich brauche mehr Schlaf.|Мне нужно больше сна.
Stimme|die Stimme|голос|Женский род · ед. ч.; мн. die Stimmen|Ihre Stimme ist leise.|У неё тихий голос.
Minuten|die Minute|минута|Женский род · здесь Dativ мн. ч.; die Minuten|Ich warte seit zehn Minuten.|Я жду десять минут.
Kauen|das Kauen|жевание|Субстантивированный инфинитив · ср. род · Nominativ ед. ч.|Ich höre sein Kauen.|Я слышу, как он жуёт.
Hause|das Haus|дом; здесь домой|nach Hause — устойчивое выражение направления. Не путать с zu Hause — дома.|Ich gehe nach Hause.|Я иду домой.
Scheiben|die Scheibe|ломтик|Женский род · Akkusativ мн. ч.; die Scheiben. Здесь о хлебе.|Ich esse zwei Scheiben Brot.|Я ем два ломтика хлеба.|Поддержка · значение для рассказа
Lampe|die Lampe|лампа|Женский род · ед. ч.; мн. die Lampen|Die Lampe ist an.|Лампа включена.
Augenblick|der Augenblick|момент|Мужской род · ед. ч.; in diesem Augenblick — в этот момент|In diesem Augenblick klingelt das Telefon.|В этот момент звонит телефон.
Weile|die Weile|некоторое время|Женский род · Dativ ед. ч. после nach|Nach einer Weile kommt sie zurück.|Через некоторое время она возвращается.
`, 'Существительное');
entries(`
wachte,aufgewacht|aufwachen|проснуться|Отделяемый глагол: wacht auf · wachte auf · ist aufgewacht|Ich bin um sieben aufgewacht.|Я проснулась в семь.
war,waren,wäre,ist,sein,gewesen|sein|быть|ist · war · ist gewesen; wäre — Konjunktiv II|Gestern war ich zu Hause.|Вчера я была дома.
überlegte|überlegen|задуматься, обдумывать|überlegt · überlegte · hat überlegt|Ich überlege, was ich kochen kann.|Я думаю, что приготовить.
hatte,habe,hab,hättest|haben|иметь; вспомогательный глагол|hat · hatte · hat gehabt. hab — разговорное habe.|Ich habe etwas gehört.|Я что-то услышала.
gestoßen|stoßen|задеть, удариться о|stößt · stieß · hat/ist gestoßen; здесь hatte gegen einen Stuhl gestoßen|Ich habe gegen den Tisch gestoßen.|Я задела стол.
horchte|horchen|прислушиваться|horcht · horchte · hat gehorcht|Sie horcht an der Tür.|Она прислушивается у двери.
fuhr|fahren|провести рукой|fährt · fuhr · ist/hat gefahren. Здесь mit der Hand über … fahren, а не ехать.|Sie fährt mit der Hand über den Tisch.|Она проводит рукой по столу.
fand|finden|обнаружить; посчитать|findet · fand · hat gefunden|Ich finde das Zimmer leer.|Я обнаруживаю, что комната пустая.
gemacht,machte,machen|machen|делать|macht · machte · hat gemacht; Licht machen — включить свет|Ich mache das Licht an.|Я включаю свет.
fehlte|fehlen|отсутствовать|fehlt · fehlte · hat gefehlt|Hier fehlt ein Stuhl.|Здесь не хватает стула.
stand,standen,stehen|stehen|стоять|steht · stand · hat gestanden; stand auf — от aufstehen|Das Glas steht auf dem Tisch.|Стакан стоит на столе.
tappte,tappten|tappen|идти ощупью|tappt · tappte · ist getappt|Sie tappt durch das dunkle Zimmer.|Она идёт ощупью по тёмной комнате.
trafen|sich treffen|встретиться|trifft · traf · hat getroffen; trafen sich — встретились|Wir treffen uns in der Küche.|Мы встречаемся на кухне.
sah,sieht,sehen|sehen|видеть; смотреть|sieht · sah · hat gesehen; sah aus — выглядел; sah an — смотрел на|Ich sehe dich am Fenster.|Я вижу тебя у окна.
abgeschnitten|abschneiden|отрезать|schneidet ab · schnitt ab · hat abgeschnitten|Ich schneide ein Stück Brot ab.|Я отрезаю кусок хлеба.
lag,lagen,liegt|liegen|лежать; быть причиной|liegt · lag · hat gelegen; liegt an — дело в …|Das Brot liegt auf dem Teller.|Хлеб лежит на тарелке.
gingen,ging|gehen|идти|geht · ging · ist gegangen|Wir gehen zu Bett.|Мы идём спать.
fühlte|fühlen|чувствовать|fühlt · fühlte · hat gefühlt|Ich fühle die Kälte.|Я чувствую холод.
kroch,krieche|kriechen|ползти; забраться|kriecht · kroch · ist gekrochen|Ich krieche unter die Decke.|Я забираюсь под одеяло.
dachte|denken|думать, полагать|denkt · dachte · hat gedacht|Ich dachte, du bist zu Hause.|Я думала, что ты дома.|A2|LX-1083
sagte|sagen|сказать|sagt · sagte · hat gesagt|Er sagt nichts.|Он ничего не говорит.
gehört,hörte|hören|слышать|hört · hörte · hat gehört|Ich habe ein Geräusch gehört.|Я услышала шум.|A1 · повторение|LX-0152
antwortete|antworten|ответить|antwortet · antwortete · hat geantwortet|Sie antwortet leise.|Она тихо отвечает.
aussah|aussehen|выглядеть|sieht aus · sah aus · hat ausgesehen|Er sieht müde aus.|Он выглядит уставшим.
anziehen|anziehen|надеть|zieht an · zog an · hat angezogen|Zieh deine Schuhe an!|Надень обувь!
sollen,sollte|sollen|следовать, быть должным|soll · sollte; sollen + Infinitiv|Du solltest mehr schlafen.|Тебе стоит больше спать.
erkältest|sich erkälten|простудиться|du erkältest dich · erkältete sich · hat sich erkältet|Du erkältest dich!|Ты простудишься!
ertragen|ertragen|выносить, терпеть|erträgt · ertrug · hat ertragen|Ich kann den Lärm nicht ertragen.|Я не могу выносить шум.
konnte,können,kann,kannst|können|мочь|kann · konnte; können + Infinitiv|Ich kann dir helfen.|Я могу тебе помочь.
log|lügen|лгать|lügt · log · hat gelogen|Er lügt nicht.|Он не лжёт.
stellte|stellen|поставить; убрать (здесь)|stellt · stellte · hat gestellt|Ich stelle den Teller auf den Tisch.|Я ставлю тарелку на стол.
schnippte|schnippen|смахнуть щелчком|schnippt · schnippte · hat geschnippt|Sie schnippt die Krümel vom Tisch.|Она смахивает крошки со стола.
echote|echoen|повторить как эхо|Здесь echote — Präteritum, 3-е лицо ед. ч.; авторское образное употребление|„Nichts“, wiederholt er.|«Ничего», — повторяет он.
kam,Komm|kommen|приходить; иди (здесь)|kommt · kam · ist gekommen. Komm — повелительное наклонение, du.|Komm zu mir!|Подойди ко мне!
muss|müssen|быть должным; должно быть|muss · musste. muss wohl … gewesen sein — вероятно, это было …|Ich muss das Licht ausmachen.|Мне нужно выключить свет.
hob|heben|поднять|hebt · hob · hat gehoben|Sie hebt die Hand.|Она поднимает руку.
ausmachen|ausmachen|выключить|macht aus · machte aus · hat ausgemacht|Mach bitte das Licht aus.|Выключи, пожалуйста, свет.
darf|dürfen|мочь, иметь разрешение|darf · durfte; darf nicht — нельзя|Ich darf hier nicht parken.|Мне нельзя здесь парковаться.
schlägt|schlagen|ударяться; бить|schlägt · schlug · hat geschlagen|Der Ast schlägt gegen das Fenster.|Ветка бьётся об окно.
klappert|klappern|стучать, дребезжать|klappert · klapperte · hat geklappert|Die Tür klappert im Wind.|Дверь стучит на ветру.
platschten|platschen|шлёпать, издавать шлепки|platscht · platschte; здесь звук босых шагов|Seine Füße platschen auf den Boden.|Его ноги шлёпают по полу.
meinte|meinen|сказать; полагать|meint · meinte · hat gemeint|Was meinst du?|Что ты думаешь?
merkte,merken|merken|заметить|merkt · merkte · hat gemerkt|Ich merke, dass du müde bist.|Я замечаю, что ты устала.
klang|klingen|звучать|klingt · klang · hat geklungen|Seine Stimme klingt ruhig.|Его голос звучит спокойно.
gähnte|gähnen|зевнуть|gähnt · gähnte · hat gegähnt|Ich gähne, weil ich müde bin.|Я зеваю, потому что устала.
kaute|kauen|жевать|kaut · kaute · hat gekaut|Er kaut langsam.|Он медленно жуёт.
atmete|atmen|дышать|atmet · atmete · hat geatmet|Sie atmet tief.|Она глубоко дышит.
einschlief|einschlafen|заснуть|schläft ein · schlief ein · ist eingeschlafen|Ich bin schnell eingeschlafen.|Я быстро заснула.
schob|schieben|подвинуть|schiebt · schob · hat geschoben|Sie schiebt ihm den Teller hin.|Она пододвигает ему тарелку.
essen,Iss|essen|есть|isst · aß · hat gegessen; Iss — Imperativ, du|Iss noch ein Stück Brot!|Съешь ещё кусок хлеба!|A1 · повторение|LX-0221
vertragen,vertrag|vertragen|переносить (пищу)|verträgt · vertrug · hat vertragen; vertrag — разговорное vertrage|Ich vertrage Milch nicht gut.|Я плохо переношу молоко.
beugte|sich beugen|наклониться|beugt sich · beugte sich · hat sich gebeugt|Er beugt sich über den Tisch.|Он наклоняется над столом.
tat|tun|делать; вызывать чувство|tut · tat · hat getan; jemandem leidtun — вызывать сочувствие|Du tust mir leid.|Мне тебя жаль.
setzte|sich setzen|сесть|setzt sich · setzte sich · hat sich gesetzt|Sie setzt sich an den Tisch.|Она садится за стол.
`, 'Глагол');
entries(`
still|still|тихо; тихий|Здесь предикативное прилагательное без окончания|Es ist still.|Тихо.
leer|leer|пустой|Предикативное прилагательное без окончания|Das Zimmer ist leer.|Комната пустая.
dunkle,dunklen|dunkel|тёмный|Прилагательное с падежным окончанием|Die Wohnung ist dunkel.|В квартире темно.
sauber|sauber|чистый|Здесь без окончания: sauber machen — приводить в порядок|Ich mache den Tisch sauber.|Я убираю стол.
alt|alt|старый|Прилагательное без окончания; Komparativ: älter|Er sieht alt aus.|Он выглядит старым.
jünger|jung|моложе|Сравнительная степень: jung → jünger|Mein Bruder ist jünger.|Мой брат младше.
barfuß|barfuß|босиком|Неизменяемое слово; характеристика состояния|Ich gehe barfuß.|Я хожу босиком.
kalten,kalt|kalt|холодный; холодно|kalt без окончания; kalten — склоняемая форма|Die Fliesen sind kalt.|Плитка холодная.|A2|LX-1223
verheiratet|verheiratet|женаты|Прилагательное; verheiratet sein — состоять в браке|Sie sind seit vielen Jahren verheiratet.|Они женаты много лет.|A1 · повторение|LX-0183
sinnlos|sinnlos|бессмысленно|Прилагательное в обстоятельственном употреблении|Er sieht sinnlos umher.|Он бесцельно оглядывается.
unsicher|unsicher|неуверенно|Прилагательное в обстоятельственном употреблении|Sie antwortet unsicher.|Она отвечает неуверенно.
nackten|nackt|голый, босой|Прилагательное: ihre nackten Füße, Nom. мн. ч.|Ihre Füße sind nackt.|Её ноги босые.
ganze|ganz|целый|Прилагательное: die ganze Nacht, Akk. ед. ч., ж. род|Ich habe die ganze Nacht gelesen.|Я читала всю ночь.
unecht|unecht|неискренне, ненатурально|Предикативное прилагательное без окончания|Seine Stimme klingt unecht.|Его голос звучит неискренне.
Gute,gut|gut|хороший; хорошо|Gute Nacht — пожелание, Akk. ед. ч., ж. род|Gute Nacht!|Спокойной ночи!
vorsichtig|vorsichtig|осторожно|Прилагательное в обстоятельственном употреблении|Er öffnet vorsichtig die Tür.|Он осторожно открывает дверь.|A2|LX-1537
wach|wach|бодрствовать, не спать|Предикативное прилагательное без окончания|Ich bin noch wach.|Я ещё не сплю.|A2|LX-1540
regelmäßig|regelmäßig|равномерный, регулярный|Здесь предикативное прилагательное|Sie atmet regelmäßig.|Она дышит ровно.
nächsten|nächst-|следующий|Прилагательное: am nächsten Abend, Dat. ед. ч., муж. род|Wir treffen uns nächste Woche.|Мы встречаемся на следующей неделе.
ruhig|ruhig|спокойно; смело (здесь)|Du kannst ruhig … — ты можешь смело …|Du kannst ruhig fragen.|Ты можешь смело спросить.
leid|leid|жаль|Часть выражения jemandem leidtun; tat er ihr leid — ей стало его жаль|Er tut mir leid.|Мне его жаль.
`, 'Прилагательное');
entries(`
plötzlich|plötzlich|вдруг|Наречие · неизменяемое слово
halb|halb|половина; наполовину|halb drei — 2:30, половина третьего
warum|warum|почему|Вопросительное наречие; вводит косвенный вопрос
besonders|besonders|особенно|Наречие
etwas|etwas|что-то|Неопределённое местоимение
jemand|jemand|кто-то|Неопределённое местоимение · Nominativ здесь
nachts|nachts|ночью|Наречие времени; то же значение, что in der Nacht
abends|abends|вечером, по вечерам|Наречие времени
noch|noch|ещё|Наречие/частица
immer|immer|всегда|Наречие частотности
nun|nun|теперь|Наречие
langsam|langsam|медленно, постепенно|Наречное употребление
hier|hier|здесь|Наречие места
auch|auch|тоже|Частица
dabei|dabei|при этом|Местоименное наречие
doch|doch|же; всё-таки; напротив|Модальная частица; в ответе на отрицание — «нет, всё-таки да»
schon|schon|уже|Наречие/частица
recht|recht|довольно; толком|Наречие степени; nicht so recht — не очень хорошо
tagsüber|tagsüber|днём|Наречие времени
manchmal|manchmal|иногда|Наречие частотности
ziemlich|ziemlich|довольно|Наречие степени
vielleicht|vielleicht|возможно|Наречие вероятности
dann|dann|тогда, затем|Наречие времени
einmal|einmal|один раз; раз|auf einmal — вдруг, сразу
nicht|nicht|не|Отрицательная частица
wieder|wieder|снова|Наречие
wohl|wohl|вероятно, пожалуй|Модальная частица предположения
nichts|nichts|ничего|Неопределённое отрицательное местоимение
nein|nein|нет|Отрицательный ответ
man|man|же, ну (здесь)|В Komm man / Iss man — северонемецкая разговорная частица, не местоимение man «люди»
draußen|draußen|снаружи, на улице|Наречие места
ja|ja|да; ведь|Ответ или модальная частица
jetzt|jetzt|сейчас|Наречие времени
sonst|sonst|иначе; обычно (по контексту)|Наречие
sicher|sicher|наверняка|Наречное употребление
beide|beide|оба|Местоименное числительное
leise|leise|тихо|Прилагательное в обстоятельственном употреблении|||A1 · повторение|LX-0518
ganz|ganz|совсем, довольно (здесь)|Наречие степени; ganz schön — довольно сильно
schön|schön|довольно (здесь)|В ganz schön kalt — довольно холодно
absichtlich|absichtlich|намеренно|Наречное употребление
tief|tief|глубоко; низко|Наречное употребление
gleichmäßig|gleichmäßig|равномерно|Наречное употребление
davon|davon|от этого|Местоименное наречие, отсылка к жеванию
nur|nur|только|Ограничительная частица
mehr|mehr|больше; ещё|Сравнительное количественное слово
erst|erst|лишь, только|Наречие/частица
da|da|там; тогда|Наречие
hoch|hoch|вверх|Здесь часть hoch kroch — поднимался вверх
weg|weg|прочь, в сторону|Частица отделяемого глагола: wegsehen / weggehen
umher|umher|вокруг, по сторонам|Наречие, относится к sah
hin|hin|в направлении; к|Частица направления; hinschieben — пододвинуть
gegenüber|gegenüber|друг напротив друга|Здесь наречие при sich gegenüberstehen
auf,aus,an|auf / aus / an|вверх; выключить/наружу; на|Предлог или отделяемая часть глагола; см. форму в контексте
`, 'Наречие / частица');
entries(`
ich|ich|я|Личное местоимение · Nominativ · 1-е лицо ед. ч.
du|du|ты|Личное местоимение · Nominativ · 2-е лицо ед. ч.
er|er|он|Личное местоимение · Nominativ · 3-е лицо ед. ч.
sie|sie|она; они|Личное местоимение: чаще «она», при trafen / standen / tappten / lagen — «они»
es|es|это; оно|Личное местоимение ср. рода; также формальное подлежащее Es war still
sich|sich|себя; друг друга|Возвратное местоимение 3-го лица; падеж зависит от глагола
ihn|er|его|Личное местоимение · Akkusativ · муж. род · ед. ч.
ihm|er|ему|Личное местоимение · Dativ · муж. род · ед. ч.
ihr|sie|ей|Личное местоимение · Dativ · ж. род · ед. ч.
dich|du|тебя; себя|Личное / возвратное местоимение · Akkusativ · 2-е лицо ед. ч.
sein,seine,seinen|sein|его (принадлежность)|Притяжательный определитель; окончание согласуется с существительным
ihre|ihr|её / их|Притяжательный определитель; здесь ihre nackten Füße — её босые ноги
dieses,diesem|dieser|этот|Указательный определитель; dieses Brot — Akk. ср. род; diesem Augenblick — Dat. муж. род
was|was|что; что-то|Относительное / неопределённое местоимение; hier wäre was = hier wäre etwas
andere|ander-|другой|Местоименное прилагательное; in die andere (Ecke) — в другой угол
der,die,das,dem,den|der / die / das|определённый артикль|Род, число и падеж определяются именной группой; das также бывает местоимением «это»
einen,einer,eine|ein|неопределённый артикль; один|einen Stuhl — Akk. муж. род; einer Ecke — Dat. ж. род; eine mehr — ещё один ломтик
jeden|jeder|каждый|Определитель: jeden Abend — Akk. муж. род, обстоятельство времени
vielen|viel|много|Определитель: nach vielen Minuten — Dat. мн. ч.
`, 'Местоимение / артикль');
entries(`
in|in|в|Предлог: Wo? + Dativ; Wohin? + Akkusativ
gegen|gegen|о, против|Предлог + Akkusativ
nach|nach|после; к, в направлении|Предлог + Dativ; nach Hause — домой
mit|mit|с|Предлог + Dativ
über|über|над; по|Переменный предлог: Dativ / Akkusativ по конструкции
neben|neben|рядом с|Переменный предлог: Dativ / Akkusativ
durch|durch|через, по|Предлог + Akkusativ
zur|zu der|к, на|Слияние zu + der · Dativ · ж. род
zum|zu dem|к|Слияние zu + dem · Dativ · муж. / ср. род
am|an dem|у, на; вечером (am Abend)|Слияние an + dem · Dativ
im|in dem|в|Слияние in + dem · Dativ
um|um|в (о времени)|Предлог + Akkusativ; um halb drei — в 2:30
zu|zu|слишком; к|zu still — слишком тихо; zu Bett — спать
von|von|от, с|Предлог + Dativ
vom|von dem|со, от|Слияние von + dem · Dativ
bei|bei|при, у|Предлог + Dativ
unter|unter|под|Переменный предлог: Dativ / Akkusativ
und|und|и|Сочинительный союз
als|als|когда|Союз однократного события в прошлом; глагол в конце придаточного
dass|dass|что|Подчинительный союз; глагол в конце придаточного
wenn|wenn|когда; если|Подчинительный союз повторения / условия
aber|aber|но|Сочинительный союз
wie|wie|как|Союз / сравнительное слово
weil|weil|потому что|Подчинительный союз причины; глагол в конце
nachdem|nachdem|после того как|Подчинительный союз; здесь с Präteritum состояния
ob|ob|ли; в als ob — словно|Подчинительный союз
damit|damit|чтобы|Союз цели; глагол в конце придаточного
ach|ach|ах|Междометие
so|so|так|Наречие; Ach so! — А, вот почему!
drei,vier,zwei,dreiundsechzig,neununddreißig|Zahl|три / четыре / два / шестьдесят три / тридцать девять|Количественное числительное; halb drei — 2:30
`, 'Служебное слово');
// Отдельные словарные заголовки для разных токенов.
lex.lichtschalter={...lex.lichtschalter,lemma:'der Lichtschalter',ru:'выключатель',info:'Мужской род · ед. ч.; мн. die Lichtschalter',example:'Der Lichtschalter ist neben der Tür.',exru:'Выключатель рядом с дверью.',level:'Поддержка',id:''};
lex.licht={...lex.licht,lemma:'das Licht',ru:'свет',info:'Средний род · ед. ч.; Licht machen — включить свет'};
for(const [form,meaning] of Object.entries({drei:'три',vier:'четыре',zwei:'два',dreiundsechzig:'шестьдесят три',neununddreißig:'тридцать девять'}))lex[form]={...lex[form],lemma:form,ru:meaning};

const paragraphs=scenes.flatMap(s=>s.paragraphs);
const readingPages=[];let page=[],count=0;
paragraphs.forEach((text,index)=>{const n=(text.match(/[\p{L}]+/gu)||[]).length;if(count+n>165&&page.length){readingPages.push(page);page=[];count=0;}page.push(index);count+=n;});if(page.length)readingPages.push(page);
if(readingPages.length>1&&readingPages.at(-1).reduce((n,i)=>n+(paragraphs[i].match(/[\p{L}]+/gu)||[]).length,0)<60){const last=readingPages.pop();readingPages.at(-1).push(...last);}
const targetWords=[
{key:'überlegte',lemma:'überlegen',ru:'обдумывать, размышлять',forms:'überlegt · überlegte · hat überlegt',context:'Sie überlegte, warum sie aufgewacht war.',example:'Ich überlege, wie ich dir helfen kann.',exru:'Я думаю, как могу тебе помочь.'},
{key:'abgeschnitten',lemma:'abschneiden',ru:'отрезать',forms:'schneidet ab · schnitt ab · hat abgeschnitten',context:'Sie sah, dass er sich Brot abgeschnitten hatte.',example:'Kannst du mir eine Scheibe Brot abschneiden?',exru:'Можешь отрезать мне ломтик хлеба?'},
{key:'scheiben',lemma:'die Scheibe',ru:'ломтик, тонкий кусок',forms:'die Scheibe · die Scheiben',context:'… schob sie ihm vier Scheiben Brot hin.',example:'Ich hätte gern zwei Scheiben Käse.',exru:'Я бы хотела два ломтика сыра.'},
{key:'log',lemma:'lügen',ru:'лгать',forms:'lügt · log · hat gelogen',context:'… dass er log.',example:'Ich möchte nicht lügen.',exru:'Я не хочу лгать.'},
{key:'ertragen',lemma:'ertragen',ru:'выносить, терпеть',forms:'erträgt · ertrug · hat ertragen',context:'… weil sie nicht ertragen konnte, dass er log.',example:'Ich kann diesen Lärm nicht ertragen.',exru:'Я не могу выносить этот шум.'},
{key:'erkältest',lemma:'sich erkälten',ru:'простудиться',forms:'erkältet sich · erkältete sich · hat sich erkältet',context:'Du erkältest dich noch.',example:'Ich habe mich erkältet und bleibe heute zu Hause.',exru:'Я простудилась и сегодня остаюсь дома.'},
{key:'vertragen',lemma:'vertragen',ru:'переносить (пищу, вещество)',forms:'verträgt · vertrug · hat vertragen',context:'Ich kann dieses Brot nicht so recht vertragen.',example:'Ich vertrage Milch nicht gut.',exru:'Я плохо переношу молоко.'},
{key:'vorsichtig',lemma:'vorsichtig',ru:'осторожный; осторожно',forms:'Прилагательное; vorsichtig sein — быть осторожным',context:'… dass er leise und vorsichtig kaute.',example:'Sei vorsichtig, der Teller ist heiß!',exru:'Осторожно, тарелка горячая!'},
{key:'absichtlich',lemma:'absichtlich',ru:'намеренно, специально',forms:'Прилагательное в наречном употреблении',context:'Sie atmete absichtlich tief und gleichmäßig …',example:'Das habe ich nicht absichtlich gemacht.',exru:'Я сделала это не специально.'},
{key:'gleichmäßig',lemma:'gleichmäßig',ru:'равномерный; равномерно',forms:'Прилагательное в наречном употреблении',context:'Sie atmete absichtlich tief und gleichmäßig …',example:'Atme langsam und gleichmäßig.',exru:'Дыши медленно и ровно.'},
{key:'beugte',lemma:'sich beugen',ru:'наклониться, наклоняться',forms:'beugt sich · beugte sich · hat sich gebeugt',context:'… wie er sich tief über den Teller beugte.',example:'Sie beugt sich über das Buch.',exru:'Она наклоняется над книгой.'},
{key:'einschlief',lemma:'einschlafen',ru:'заснуть',forms:'schläft ein · schlief ein · ist eingeschlafen',context:'… dass sie davon langsam einschlief.',example:'Gestern bin ich erst um Mitternacht eingeschlafen.',exru:'Вчера я заснула только в полночь.'},
{key:'merkte',lemma:'merken',ru:'заметить',forms:'merkt · merkte · hat gemerkt',context:'Aber sie merkte, wie unecht seine Stimme klang …',example:'Ich habe gemerkt, dass du müde bist.',exru:'Я заметила, что ты устал.'},
{key:'tat',lemma:'jemandem leidtun',ru:'вызывать сочувствие; быть жаль',forms:'tut jemandem leid · tat jemandem leid · hat jemandem leidgetan',context:'In diesem Augenblick tat er ihr leid.',example:'Du tust mir leid. Kann ich dir helfen?',exru:'Мне тебя жаль. Могу я тебе помочь?'},
{key:'wachte',lemma:'aufwachen',ru:'проснуться',forms:'wacht auf · wachte auf · ist aufgewacht',context:'Plötzlich wachte sie auf.',example:'Heute bin ich sehr früh aufgewacht.',exru:'Сегодня я проснулась очень рано.'}
];
// Список курса фиксирован. Личные слова из текста хранятся отдельно.
const comprehension=[
{id:'c1',q:'Woran merkt die Frau, dass ihr Mann Brot abgeschnitten hat?',ru:'Какие детали выдают мужа? Назовите две.',help:'Auf dem Tisch … / Neben dem Teller …',model:'Das Messer liegt neben dem Teller. Auf der Decke liegen Brotkrümel.'},
{id:'c2',q:'Wie hilft die Frau ihrem Mann in der Nacht?',ru:'Как она помогает ему выйти из неловкой ситуации?',help:'Sie sagt, dass … / Sie macht …',model:'Sie sagt, dass das Geräusch wohl draußen war. Dann macht sie das Licht aus. Sie spricht nicht über das Brot.'},
{id:'c3',q:'Was verändert sich beim Abendessen am nächsten Tag?',ru:'Что меняется на следующий вечер? Объясните, почему это важно.',help:'Er bekommt … statt … / Sie selbst …',model:'Er bekommt vier Scheiben Brot statt drei. Sie selbst isst nur zwei. So bekommt er mehr zu essen.'}
];
const vocabExercises=[
{id:'l1',before:'Bitte sei ',after:': Das Messer ist scharf.',answer:'vorsichtig',why:'vorsichtig sein — быть осторожным.'},
{id:'l2',before:'Ich kann diese Milch nicht gut ',after:'.',answer:'vertragen',why:'vertragen — переносить пищу; после kann нужен инфинитив.'},
{id:'l3',before:'Das war kein Versehen. Er hat es ',after:' gemacht.',answer:'absichtlich',why:'kein Versehen — не случайность; absichtlich — намеренно.'},
{id:'l4',before:'Sie war sehr müde und ist sofort ',after:'.',answer:'eingeschlafen',why:'einschlafen → ist eingeschlafen: изменение состояния, вспомогательный sein.'},
{id:'l5',before:'Er hat nicht die Wahrheit gesagt. Er hat ',after:'.',answer:'gelogen',why:'lügen → hat gelogen: солгать.'},
{id:'l6',before:'Ich habe ',after:', dass du heute sehr still bist.',answer:'gemerkt',why:'merken → hat gemerkt: заметить, что …'}
];
const pastExercises=[
{id:'p1',before:'Plötzlich ',after:' sie auf. (aufwachen)',answer:'wachte',why:'Слабый глагол: wach- + -te. Приставка auf уже стоит в конце.'},
{id:'p2',before:'Das Messer ',after:' neben dem Teller. (liegen)',answer:'lag',why:'Сильный глагол: liegen → lag. У er/sie/es нет личного окончания.'},
{id:'p3',before:'Er ',after:', dass draußen etwas war. (denken)',answer:'dachte',why:'denken → dachte: меняется основа, добавляется -te.'},
{id:'p4',before:'Sie ',after:' etwas. (hören)',answer:'hörte',why:'Слабый глагол: hör- + -te.'},
{id:'p5',before:'Im Bett ',after:' er leise. (kauen)',answer:'kaute',why:'Слабый глагол: kau- + -te.'},
{id:'p6',before:'Am nächsten Abend ',after:' er nach Hause. (kommen)',answer:'kam',why:'Сильный глагол: kommen → kam.'}
];
const weilExercises=[
{id:'w1',start:'Ich helfe dir,',tokens:['bist.','du','weil','müde'],answer:['weil','du','müde','bist.'],why:'После weil: подлежащее du, затем müde, личный глагол bist — в конце.'},
{id:'w2',start:'Sie bleibt zu Hause,',tokens:['hat.','weil','erkältet','sie','sich'],answer:['weil','sie','sich','erkältet','hat.'],why:'В Perfekt личный вспомогательный глагол hat идёт в конец, после Partizip II: sich erkältet hat.'},
{id:'w3',start:'Er isst noch eine Scheibe Brot,',tokens:['Hunger','hat.','er','weil'],answer:['weil','er','Hunger','hat.'],why:'weil er Hunger hat — потому что он голоден.'},
{id:'w4',start:'Weil sie müde ist,',tokens:['ins Bett.','sie','geht','früh'],answer:['geht','sie','früh','ins Bett.'],why:'Придаточное заняло первое место. Поэтому главное начинается с личного глагола geht, а подлежащее sie идёт после него.'}
];

lex.etwas.type='Неопределённое местоимение';
return {lex,paragraphs,readingPages,targetWords,comprehension,vocabExercises,pastExercises,weilExercises};
})()

const READER_SECTIONS = [
  ['intro','О книге'],
  ['reading','Читать'],
  ['vocab','Словарь'],
  ['grammar','Грамматика'],
  ['tasks','Задания']
]
const COMPLETABLE = ['reading','vocab','grammar','tasks']

const esc = value => String(value ?? '')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')

function defaultState() {
  return { section:'intro', page:0, font:22, done:[], words:{}, task:0, answers:{}, grammarMode:'rules' }
}

function stateKey(userId) {
  return `lernstep:reader:das-brot:${userId || 'anonymous'}`
}

function loadState(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(stateKey(userId)) || 'null')
    return parsed && typeof parsed === 'object' ? { ...defaultState(), ...parsed } : defaultState()
  } catch {
    return defaultState()
  }
}

function renderTextParagraph(text) {
  return String(text).split(/(\p{L}+(?:['’\-]\p{L}+)*)/gu).map(token => {
    const entry = READER_DATA.lex[token.toLocaleLowerCase('de-DE')]
    return entry
      ? `<button class="reader-word" type="button" data-reader-word="${esc(token)}">${esc(token)}</button>`
      : esc(token)
  }).join('')
}

export function mountReader(host, userId) {
  if (!host) return
  let state = loadState(userId)
  let popupWord = null
  let speech = null

  const persist = () => {
    try { localStorage.setItem(stateKey(userId), JSON.stringify(state)) } catch {}
  }
  const complete = section => {
    if (!state.done.includes(section)) state.done.push(section)
    persist()
  }
  const goto = section => {
    if (!READER_SECTIONS.some(([id]) => id === section)) return
    state.section = section
    persist()
    render()
  }
  const progress = () => COMPLETABLE.filter(id => state.done.includes(id)).length

  function readerShell(body) {
    const n = progress()
    return `<div class="native-reader">
      <aside class="reader-course-sidebar">
        <div class="reader-sidebar-title">ВАШ МИНИ-КУРС</div>
        <div class="reader-book-mini">
          <div class="reader-mini-cover"><span>Das<br>Brot</span><small>W. Borchert</small></div>
          <div><b>Das Brot</b><span>Wolfgang Borchert</span><small>Чтение · 8–10 минут</small></div>
        </div>
        <nav class="reader-nav" aria-label="Разделы мини-курса">
          ${READER_SECTIONS.map(([id,label],index)=>`<button type="button" class="${state.section===id?'active':''}" data-reader-section="${id}"><span>${String(index+1).padStart(2,'0')}</span>${esc(label)}${state.done.includes(id)?'<b aria-label="завершено">✓</b>':''}</button>`).join('')}
        </nav>
        <div class="reader-course-progress">
          <div><b>Мой прогресс</b><span>${n} / 4</span></div>
          <div class="reader-progress"><i style="width:${n/4*100}%"></i></div>
          <small>Прогресс сохраняется в этом браузере</small>
        </div>
        <div class="reader-sidebar-note"><span>✧</span><b>Читаем не спеша</b><p>Не нужно понимать каждое слово с первого раза. Сначала пойми, что происходит между героями.</p></div>
      </aside>
      <section class="reader-workspace">
        ${body}
      </section>
      ${popupWord ? renderWordPopup(popupWord) : ''}
    </div>`
  }

  function renderIntro() {
    return `<div class="reader-crumb">Библиотека / Немецкая литература</div>
      <section class="reader-hero">
        <div class="reader-hero-copy">
          <div class="eyebrow">WOLFGANG BORCHERT · 1946</div>
          <h1>Das Brot <span>Хлеб</span></h1>
          <p class="reader-description">Ночью женщина застаёт мужа на кухне. Между ними — несколько ломтиков хлеба и разговор, в котором самое важное остаётся невысказанным.</p>
          <div class="reader-pills"><span class="badge green">A2</span><span class="badge">Рассказ</span></div>
          <div class="reader-meta"><span>◷ примерно 8–10 минут</span><span>732 слова</span></div>
          <div class="actions"><button class="btn" type="button" data-reader-section="reading">Читать →</button><button class="btn secondary" type="button" data-reader-listen="all">Слушать</button></div>
        </div>
        <div class="reader-cover" aria-hidden="true"><span class="reader-cover-kicker">WOLFGANG BORCHERT</span><strong>Das<br>Brot</strong><small>1946</small></div>
      </section>
      <div class="reader-info-grid">
        <article class="card"><div class="eyebrow">КОНТЕКСТ</div><h2>Германия, 1946 год</h2><p>После Второй мировой войны в Германии остро не хватало продовольствия. Даже обычный хлеб приходилось экономить.</p><p>В рассказе важнее всего не сам поступок, а то, как супруги бережно обходятся с неловкостью, нуждой и достоинством друг друга.</p></article>
        <article class="card"><div class="eyebrow">ОБ АВТОРЕ</div><h2>Wolfgang Borchert</h2><p class="muted">1921–1947</p><p>Немецкий писатель послевоенного поколения. Его короткая проза говорит о повседневной жизни, голоде, уязвимости и человеческом участии.</p></article>
      </div>`
  }

  function renderReading() {
    const pages = READER_DATA.readingPages
    const page = Math.max(0, Math.min(state.page, pages.length-1))
    state.page = page
    const paragraphs = pages[page].map(index => `<p>${renderTextParagraph(READER_DATA.paragraphs[index])}</p>`).join('')
    return `<div class="reader-crumb">Библиотека / Das Brot</div>
      <div class="reader-section-top"><div><div class="eyebrow">ЧТЕНИЕ</div><h1>Das Brot</h1><p>Wolfgang Borchert · примерно 8–10 минут</p></div></div>
      <div class="reader-audio-panel"><button class="reader-play" type="button" data-reader-listen="page" aria-label="Слушать текущую страницу">▶</button><div><b>Слушать</b><small>Текущая страница</small></div><button class="btn text compact" type="button" data-reader-stop>Остановить</button></div>
      <article class="reader-card">
        <div class="reader-tools"><span>Нажми на слово, чтобы открыть перевод</span><div><button type="button" data-reader-font="-1">A−</button><button type="button" data-reader-font="1">A+</button></div></div>
        <div class="reader-text" lang="de" style="--reader-font:${state.font}px">${paragraphs}</div>
        <div class="reader-pagination"><button class="btn secondary" type="button" data-reader-page="-1" ${page===0?'disabled':''}>←</button><span>${page+1} / ${pages.length}</span><button class="btn secondary" type="button" data-reader-page="1" ${page===pages.length-1?'disabled':''}>→</button></div>
        <div class="reader-bottom"><span class="small muted">${state.done.includes('reading')?'✓ Прочитано':'Wolfgang Borchert · Das Brot'}</span><button class="btn" type="button" data-reader-complete="reading" data-reader-next="vocab">Прочитано · к словарю →</button></div>
      </article>`
  }

  function renderVocab() {
    const words = READER_DATA.targetWords
    return `<div class="reader-crumb">Библиотека / Das Brot</div>
      <div class="reader-section-top"><div><div class="eyebrow">СЛОВАРЬ</div><h1>15 слов, которые стоит запомнить</h1><p>Слова и выражения из рассказа, которые пригодятся в собственной речи.</p></div></div>
      <div class="reader-vocab-grid">${words.map((word,index)=>{
        const status=state.words[word.lemma]||''
        return `<article class="reader-vocab-card"><span class="reader-vocab-number">${String(index+1).padStart(2,'0')}</span><h3 lang="de">${esc(word.lemma)}</h3><p>${esc(word.ru)}</p><div class="reader-vocab-example" lang="de">${esc(word.example||word.context||'')}</div><small class="muted">${esc(word.forms||'')}</small><div class="actions"><button class="btn text compact ${status==='learning'?'active':''}" type="button" data-reader-word-status="${esc(word.lemma)}" data-status="learning">Учить</button><button class="btn text compact ${status==='known'?'active':''}" type="button" data-reader-word-status="${esc(word.lemma)}" data-status="known">Знаю</button></div></article>`
      }).join('')}</div>
      <div class="reader-bottom reader-bottom-standalone"><span class="small muted">${state.done.includes('vocab')?'✓ Словарь просмотрен':'Отмечай слова для повторения'}</span><button class="btn" type="button" data-reader-complete="vocab" data-reader-next="grammar">К грамматике →</button></div>`
  }

  function renderGrammar() {
    const exercise = state.grammarMode === 'exercises'
      ? `<div class="reader-exercise-grid">
          <article class="card"><h3>Präteritum</h3>${READER_DATA.pastExercises.slice(0,4).map(x=>`<details class="reader-exercise"><summary lang="de">${esc(x.before)} ___ ${esc(x.after)}</summary><p lang="de"><strong>${esc(x.answer)}</strong></p><p class="small muted">${esc(x.why)}</p></details>`).join('')}</article>
          <article class="card"><h3>weil</h3>${READER_DATA.weilExercises.slice(0,4).map(x=>`<details class="reader-exercise"><summary lang="de">${esc(x.start)} …</summary><p lang="de"><strong>${esc(x.answer.join(' '))}</strong></p><p class="small muted">${esc(x.why)}</p></details>`).join('')}</article>
        </div>`
      : `<div class="reader-rules">
          <article class="card reader-rule"><span class="badge green">Правило 1</span><h2>Präteritum: прошедшее время рассказа</h2><p>В литературном повествовании о прошлом часто используют <strong>Präteritum</strong>. Действие выражается одной личной формой глагола.</p><div class="reader-comparison"><div><small>В рассказе</small><p lang="de">Sie <strong>hörte</strong> etwas.</p></div><div><small>В разговоре</small><p lang="de">Sie <strong>hat</strong> etwas <strong>gehört</strong>.</p></div></div></article>
          <article class="card reader-rule"><span class="badge">Правило 2</span><h2>weil: глагол в конце</h2><p>В придаточном с <strong>weil</strong> личный глагол уходит в конец.</p><div class="prompt-box" lang="de">Sie hilft ihm, weil er Hunger <strong>hat</strong>.</div></article>
        </div>`
    return `<div class="reader-crumb">Библиотека / Das Brot</div><div class="reader-section-top"><div><div class="eyebrow">ГРАММАТИКА</div><h1>Два правила из рассказа</h1><p>Präteritum и предложения с weil.</p></div></div>
      <div class="reader-tabs"><button type="button" class="${state.grammarMode==='rules'?'active':''}" data-reader-grammar="rules">Правила</button><button type="button" class="${state.grammarMode==='exercises'?'active':''}" data-reader-grammar="exercises">Упражнения</button></div>
      ${exercise}
      <div class="reader-bottom reader-bottom-standalone"><span class="small muted">${state.done.includes('grammar')?'✓ Грамматика просмотрена':''}</span><button class="btn" type="button" data-reader-complete="grammar" data-reader-next="tasks">К заданиям →</button></div>`
  }

  function renderTasks() {
    const tabs=['О рассказе','Новые слова','Своя ситуация']
    let body=''
    if(state.task===0) body=`<article class="card reader-task-card"><h2>Что говорят поступки героев?</h2><p>Ответь коротко по-немецки, опираясь на текст.</p>${READER_DATA.comprehension.map((q,index)=>`<div class="reader-question"><label>${index+1}. <span lang="de">${esc(q.q)}</span></label><p class="small muted">${esc(q.ru)}</p><textarea data-reader-answer="${esc(q.id)}" lang="de" placeholder="${esc(q.help)}">${esc(state.answers[q.id]||'')}</textarea><details><summary>Сравнить с примером ответа</summary><p lang="de">${esc(q.model)}</p></details></div>`).join('')}</article>`
    if(state.task===1) body=`<article class="card reader-task-card"><h2>Новые слова в обычных ситуациях</h2><p>Открой ответ после собственной попытки.</p>${READER_DATA.vocabExercises.slice(0,6).map(x=>`<details class="reader-exercise"><summary lang="de">${esc(x.before)} ___ ${esc(x.after)}</summary><p lang="de"><strong>${esc(x.answer)}</strong></p><p class="small muted">${esc(x.why)}</p></details>`).join('')}</article>`
    if(state.task===2) body=`<article class="card reader-task-card"><h2>Своя ситуация</h2><p>Представь, что близкий человек оказался в неловкой ситуации. Напиши 3–5 предложений: что произошло и как можно отреагировать бережно.</p><textarea data-reader-answer="own" lang="de" placeholder="Ich würde …">${esc(state.answers.own||'')}</textarea><p class="small muted">Это самостоятельная практика. Ответ остаётся в этой читалке.</p></article>`
    return `<div class="reader-crumb">Библиотека / Das Brot</div><div class="reader-section-top"><div><div class="eyebrow">ЗАДАНИЯ</div><h1>От текста — к своей речи</h1></div></div><div class="reader-tabs">${tabs.map((label,index)=>`<button type="button" class="${state.task===index?'active':''}" data-reader-task="${index}">${label}</button>`).join('')}</div>${body}<div class="reader-bottom reader-bottom-standalone"><span class="small muted">${state.done.includes('tasks')?'✓ Задания отмечены как завершённые':''}</span><button class="btn" type="button" data-reader-complete="tasks">Завершить мини-курс</button></div>`
  }

  function renderWordPopup(word) {
    const info = READER_DATA.lex[String(word).toLocaleLowerCase('de-DE')]
    if (!info) return ''
    return `<div class="reader-popup-backdrop" data-reader-popup-close><aside class="reader-word-popup" role="dialog" aria-modal="true" aria-label="Слово в контексте"><button class="reader-popup-close" type="button" data-reader-popup-close aria-label="Закрыть">×</button><div class="eyebrow">СЛОВО В КОНТЕКСТЕ</div><h2 lang="de">${esc(info.lemma || word)}</h2><p class="reader-word-translation">${esc(info.ru || '')}</p>${info.info?`<p class="small muted">${esc(info.info)}</p>`:''}${info.example?`<div class="prompt-box" lang="de">${esc(info.example)}</div>`:''}${info.exru?`<p class="small muted">${esc(info.exru)}</p>`:''}</aside></div>`
  }

  function render() {
    let body=renderIntro()
    if(state.section==='reading') body=renderReading()
    if(state.section==='vocab') body=renderVocab()
    if(state.section==='grammar') body=renderGrammar()
    if(state.section==='tasks') body=renderTasks()
    host.innerHTML=readerShell(body)
  }

  host.onclick = event => {
    const closeButton=event.target.closest('.reader-popup-close')
    if(closeButton){ popupWord=null; render(); return }
    if(event.target.closest('.reader-word-popup')) return
    const popupClose=event.target.closest('[data-reader-popup-close]')
    if(popupClose){ popupWord=null; render(); return }
    const word=event.target.closest('[data-reader-word]')
    if(word){ popupWord=word.dataset.readerWord; render(); return }
    const section=event.target.closest('[data-reader-section]')
    if(section){ goto(section.dataset.readerSection); return }
    const completeButton=event.target.closest('[data-reader-complete]')
    if(completeButton){
      complete(completeButton.dataset.readerComplete)
      const next=completeButton.dataset.readerNext
      if(next) state.section=next
      persist(); render(); return
    }
    const pageButton=event.target.closest('[data-reader-page]')
    if(pageButton){ state.page=Math.max(0,Math.min(READER_DATA.readingPages.length-1,state.page+Number(pageButton.dataset.readerPage)));persist();render();return }
    const font=event.target.closest('[data-reader-font]')
    if(font){ state.font=Math.max(17,Math.min(30,state.font+Number(font.dataset.readerFont)));persist();render();return }
    const status=event.target.closest('[data-reader-word-status]')
    if(status){
      const lemma=status.dataset.readerWordStatus
      state.words[lemma]=state.words[lemma]===status.dataset.status?'':status.dataset.status
      persist();render();return
    }
    const grammar=event.target.closest('[data-reader-grammar]')
    if(grammar){ state.grammarMode=grammar.dataset.readerGrammar;persist();render();return }
    const task=event.target.closest('[data-reader-task]')
    if(task){ state.task=Number(task.dataset.readerTask);persist();render();return }
    const stop=event.target.closest('[data-reader-stop]')
    if(stop && 'speechSynthesis' in window){ speechSynthesis.cancel(); speech=null; return }
    const listen=event.target.closest('[data-reader-listen]')
    if(listen && 'speechSynthesis' in window){
      speechSynthesis.cancel()
      const text=listen.dataset.readerListen==='all'
        ? READER_DATA.paragraphs.join(' ')
        : READER_DATA.readingPages[state.page].map(index=>READER_DATA.paragraphs[index]).join(' ')
      speech=new SpeechSynthesisUtterance(text)
      speech.lang='de-DE'
      speech.rate=.92
      speechSynthesis.speak(speech)
    }
  }

  host.oninput = event => {
    const answer=event.target.closest('[data-reader-answer]')
    if(answer){ state.answers[answer.dataset.readerAnswer]=answer.value; persist() }
  }

  render()
}

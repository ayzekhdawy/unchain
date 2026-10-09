import { bookFromText, type Book } from "./books";

export type CatalogShelf = "hikaye" | "siir";

export type CatalogWork = {
  id: string;
  title: string;
  author: string;
  shelf: CatalogShelf;
  died: string;
  termEnd: string;
  sourceUrl: string;
  text: string;
};

// Kısa tam metinler. Lisans kaydı docs/katalog.md içindedir.
export const CATALOG: CatalogWork[] = [
  {
    id: "pd-kir-sinegi",
    title: "Kır Sineği",
    author: "Ömer Seyfettin",
    shelf: "hikaye",
    died: "1920-03-06",
    termEnd: "1990-12-31",
    sourceUrl: "https://tr.wikisource.org/wiki/Kır_Sineği",
    text: [
      "Bir gün... yağmurlu, kasvetli bir kış günü idi. Can sıkıntısından mütevellit bir adem-i intizam-ı efkâr ile kitaplarımı karıştırıyor, elime aldığım kitapların nihayetlerine, yahut sevdiğim sahifelerine yorgun gözlerimle bakıp tekrar okudum.",
      "Kitaplarımın en altında eski bir cep defteri buldum. Dört sene evvel yazılmış bir bunu bulduktan sonra hissediyorum ki şu sıkılan ruhumu işgal içün başka bir şey aramağa ihtiyacım yok... Kitapların hepsini acele ile yerlerine koydum ve küçük defterciği alarak, sobanın yanında bana bir âguş-ı rehavet gibi mana-yı davetle bakan koltuğa yıkıldım. Artık sahifeleri birer birer açıyordum. Nihayet bir sahife açtım. Sahifenin arasında maî, şeffaf kanatlı, incecik –öyle ki bir kumral saç teli kadar ince– zaif, minimini bir kır sineği, kendisine sarılan pembe bir kır çiçeğiyle kurumuş duruyordu.",
      "Bu zavallı esîrî böcekçiği, dört sene evvel –kim bilir nerede– üzerine konduğu çiçekle beraber defterimin arasına koymuşum. O sahifelerdeki eş’âra baktım. Sağdaki manzume yeşil boya ile resmolunmuş çiçekten bir kitabe içinde, küçük bir ağaçlık levhasının altına yazılmıştı. Diğerine baktım o da aynı tehalükle nakş olunmuştu: Cûy-ı Billûr ...",
      "O gölge içün yazılmış neşidenin, o cûy-ı billûrun nağme-i serâiriyle yazılmış güftenin visal-i müebbetleri arasında mütevâri-i nisyan olan bu minimini sinek, hayat-ı baharîsiyle ruhumda tatlı muhterem bir matem peyda etti. Bu bahar şiirinin, bu esîr kuşunun, bu hatıra-i şiirin medfen-i ilhamını bozmamak içün samimi ihtimamlarla tekrar o sahifeyi kapadım.",
      "Şimdi ne vakit bir defter, bir mecmua görsem bu defterciği ve onun içinde bir nâzikî-i ebediyetle uyuyan bu sineği derhatır ederim.."
    ].join("\n\n")
  },
  {
    id: "pd-yalnizlik",
    title: "Yalnızlık",
    author: "Ömer Seyfettin",
    shelf: "siir",
    died: "1920-03-06",
    termEnd: "1990-12-31",
    sourceUrl: "https://tr.wikisource.org/wiki/Yalnızlık",
    text: "Güneş batmakta, ovada gecenin, Gölgeleri büyür, büyür sararır Ağaçlıklar, akan sular bir serin, Rüzgâr ile dalgalanır, kararır Kuşlar ötmez, yuvalar boş görünmez Bir ışıltı uzaklarda, yazık ben Öksüzüm şimdi, bu yolda giderken Gök bile yıldızlarına bürünmez! Eski izler, çirkin korkunç lekeler, Kılavuzluk eder, zavallı atım Şüphelenir bu gidişten ve kişner... Gece gelir, ıssızlık sanki solur Ve ruhum uyur uyanır, her adım Atımın nal sadası ninni olur..."
  },
  {
    id: "pd-yasamak",
    title: "Yaşamak",
    author: "Orhan Veli Kanık",
    shelf: "siir",
    died: "1950-11-14",
    termEnd: "2020-12-31",
    sourceUrl: "https://tr.wikisource.org/wiki/Yaşamak",
    text: [
      "Biliyorum, kolay değil yaşamak; Gönül verip türkü söylemek yâr üstüne; Yıldız ışığında dolaşıp geceleri, Gündüzleri gün ışığında ısınmak; Şöyle bir fırsat bulup, yarım gün, Yan gelebilmek Çamlıca tepesine... — Bin türlü mavi akar Boğaz'dan — Herşeyi unutabilmek maviler içinde.",
      "II",
      "Biliyorum, kolay değil yaşamak; Ama işte Bir ölünün hâlâ yatağı sıcak, Birinin saati işliyor kolunda. Yaşamak kolay değil ya, kardeşler, Ölmek de değil; Kolay değil bu dünyadan ayrılmak."
    ].join("\n\n")
  }
];

export function bookFromCatalog(work: CatalogWork): Book {
  const book = bookFromText(work.title, work.author, work.text, "pd");
  return { ...book, id: work.id };
}

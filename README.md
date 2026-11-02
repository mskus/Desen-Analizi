# WarpKnitt Pro 🧶
### Çözgülü Örme Halı Desen CAD & Simülasyon Sistemi
> **Run Yuan HRD6-EL (Çift İğne Raylı Çözgülü Örme Halı Makinesi)** için geliştirilmiş, mobil öncelikli, sadeleştirilmiş endüstriyel desen tasarım ve simülasyon web uygulaması.

---

## 🚀 GitHub Pages ile Canlı Yayınlama (Canlı Site Kurulumu)

Bu repo, **GitHub Pages** ve **GitHub Actions** ile otomatik olarak canlıya alınacak şekilde yapılandırılmıştır (`base: './'` ve `.github/workflows/deploy.yml`).

### Adım Adım Canlıya Alma:
1. Bu projeyi GitHub hesabınızdaki bir depoya (repository) yükleyin (`git push origin main`).
2. GitHub'da deponuzun **Settings** (Ayarlar) sekmesine gidin.
3. Sol menüden **Pages** seçeneğine tıklayın.
4. **Build and deployment > Source** kısmını **"GitHub Actions"** olarak seçin.
5. `main` dalına kod gönderildiğinde GitHub Actions projenizi otomatik olarak derleyip canlıya alır (`https://<kullanici-adiniz>.github.io/<depo-adiniz>/`).

---

## 📱 Sade & Mobil Öncelikli Tasarım Özellikleri

Uygulama arayüzü gereksiz efektlerden, yorucu renk geçişlerinden ve uzun metin kalabalığından arındırılmış, doğrudan üretim ve teknik analize odaklanan minimalist bir endüstriyel CAD görünümüne kavuşturulmuştur:

- **Mobil Alt Gezinme Barı (Bottom Navigation):** Telefon ve tabletlerde başparmakla kolayca erişilebilen hızlı sekme geçişi.
- **Canlı Simülasyon & Threading:** İğne diziminde (Dolu / Boş) yapılan her değişiklik 0 ms gecikmeyle simülasyona ve teknik tarak şemasına anında yansır.
- **İğne İzolasyonu:** Zemin taraklarını gizleyerek tek tıkla sadece çalışılan tarağın (örn: GB3) hav ve ilmeklerini inceleyebilme.
- **Sürükle & Bırak Canlı Tarak Editörü:** İğne koordinat noktalarını doğrudan ekranda parmakla veya fareyle sürükleyerek deseni canlı değiştirme.
- **10 Adet Hazır Halı Deseni:** 
  - Maksimum tek adımda 6 iğne atlama limiti (güvenli şoglama).
  - GB3 5 dolu 5 boş rölyef hav dizilimi.
  - GB5 ve GB6 tam dolu (full) zemin taban kilit örgüsü.
  - Kayıt tarihleri ve kategorileriyle hazır kütüphane.
- **Teknik Notasyon Ayrıştırıcı:** `1-0/1-2/2-1` veya `0 1 2 1 0` formatında kodları anında tabloya aktarma.
- **Tarak Kopyalama:** Örn. GB3 tarağındaki tüm hareket dizisini tek tıkla GB4'e kopyalama.
- **Güvenli Tarak Menüsü:** İğne atlama aşımı uyarısı, iğne sayısı ve güvenli RPM limitleri.
- **Dışa & İçe Aktarma:** Yüksek çözünürlüklü PNG kumaş/şema indirme, JSON ve CSV formatında desen yedekleme.

---

## 🛠️ Yerel Geliştirme (Local Setup)

```bash
# Depoyu klonlayın
git clone https://github.com/<kullanici-adiniz>/warpknitt-pro.git
cd warpknitt-pro

# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın (Port 3000)
npm run dev

# Canlı dağıtım için derleyin
npm run build
```

---

## 🏗️ Mimari & Teknolojiler
- **Framework:** React 19 + TypeScript + Vite 8
- **Stil:** Tailwind CSS v4 (Sade endüstriyel koyu tema)
- **Çizim:** HTML5 Canvas 2D (Yüksek performanslı 60fps teknik şema ve kumaş simülatörü)
- **İkonlar:** Lucide React

---

## 📄 Lisans
MIT License - Run Yuan HRD6-EL Çözgülü Örme Sistemleri.

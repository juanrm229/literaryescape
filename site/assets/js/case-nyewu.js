/* Perkara 01 · NYEWU — presentation config (skins, labels, hints). Content lives in site/data/nyewu.js */
(function (LE) {
  const letter = ['letter', 'Surat · alamat “Laut”', 'letter'];
  const card = ['stampcard', 'Kartu kenal', 'card'];
  const SKIN = {
    '0-01': ['note', 'Catatan penyusun', 'report'], '0-02': ['rules', 'Petunjuk', 'report'],
    'I-01': ['newspaper', 'Kliping koran', 'news'], 'I-02': ['gov', 'Laporan resmi', 'report'], 'I-03': ['newspaper', 'Kliping koran', 'news'],
    'I-04': ['notulen', 'Notulen', 'notebook'], 'I-05': ['notulen', 'Notulen', 'notebook'], 'I-06': ['ledger', 'Register KK', 'table'],
    'I-07': ['photo', 'Foto', 'photo'], 'I-08': ['map', 'Peta tangan', 'map'],
    'II-01': ['post', 'Kantor pos', 'letter'], 'II-32': ['logbook', 'Buku log', 'notebook'], 'II-33': ['gov', 'Berita acara', 'report'],
    'III-01': ['rukmini', 'Buku catatan', 'notebook'], 'III-02': ['tape', 'Kaset C60', 'tape'], 'III-03': ['tape-phone', 'Rekaman ponsel', 'voice'],
    'III-04': ['testimony', 'Kesaksian', 'quote'], 'III-05': ['notulen', 'Buku ronda', 'notebook'], 'III-06': ['ledger-book', 'Buku harian keluarga', 'notebook'],
    'IV-01': ['gov', 'Laporan desa', 'report'], 'IV-02': ['newspaper', 'Kliping koran', 'news'], 'IV-03': ['testimony', 'Laporan & kesaksian', 'quote'],
    'IV-04': ['tape', 'Kaset radio amatir', 'tape'], 'IV-05': ['register', 'Register puskesmas', 'table'], 'IV-06': ['testimony', 'Laporan · kesaksian · buku bengkel', 'quote'],
    'IV-07': ['gov', 'Laporan pencarian · WhatsApp', 'chat'], 'IV-08': ['analysis', 'Analisis', 'table'], 'IV-09': ['sketch', 'Sketsa pensil', 'foot'],
    'V-01': ['colonial', 'Verslag, 1891', 'report'], 'V-02': ['thesis', 'Catatan kaki', 'thesis'], 'V-03': ['colonial', 'Surat zendeling', 'letter'],
    'VI-01': ['cover', 'Skripsi', 'thesis'], 'VI-02': ['thesis', 'Skripsi', 'thesis'], 'VI-03': ['thesis', 'Skripsi', 'thesis'], 'VI-04': ['thesis', 'Lampiran', 'thesis'],
    'VI-05': ['thesis', 'Draf tesis', 'thesis'], 'VI-06': ['field', 'Catatan lapangan', 'notebook'], 'VI-06a': ['story', 'Cerpen', 'report'], 'VI-07': ['tape-phone', 'Pesan suara', 'voice'],
    'VII-01': ['journal', 'Jurnal', 'notebook'], 'VII-02': ['tape-phone', 'Wawancara', 'voice'], 'VII-03': ['tape-phone', 'Rekaman di perahu', 'voice'], 'VII-04': ['web', 'Berita daring', 'web'],
    'VIII-20': ['note', 'Catatan', 'report'],
    'IX-01': ['ritual', 'Tata cara', 'flame'], 'IX-02': ['ritual', 'Tembang', 'flame'], 'IX-03': ['tape-phone', 'Rekaman terakhir', 'voice'], 'IX-04': ['journal', 'Jurnal', 'notebook'],
  };
  const skin = (id) => SKIN[id] || (id.startsWith('II-') ? letter : id.startsWith('VIII-') ? card : ['note', 'Dokumen', 'report']);

  const TAPE = {
    'III-02': { style: 'cassette', label: 'NIKAHAN WARNI 14-10-78', brand: 'TDK · C60' },
    'IV-04': { style: 'cassette', label: 'FREK. LAUT · 27-2-03', brand: 'MAXELL · C90' },
    'III-03': { style: 'phone', label: 'Rekaman · 13 Feb 2014', length: '14:22' },
    'VI-07': { style: 'phone', label: 'Pesan suara · Gita', length: '0:47' },
    'VII-02': { style: 'phone', label: 'Rekaman · Wonokromo, Mar 2024', length: '' },
    'VII-03': { style: 'phone', label: 'Rekaman · di perahu, 6 Jun 2024', length: '' },
    'IX-03': { style: 'phone', label: 'Rekaman · 11 Feb 2027 · 22.00', length: '7:40:00' },
  };

  const BERKAS = {
    '0': { years: '2026', motif: 'door', palette: 'night' },
    I: { years: '1979', motif: 'lighthouse', palette: 'sea' },
    II: { years: '1979–2008', motif: 'envelope', palette: 'rust' },
    III: { years: '1979–2021', motif: 'wave', palette: 'slate' },
    IV: { years: '1987–2019', motif: 'footprints', palette: 'sand' },
    V: { years: '1891–1893', motif: 'stone', palette: 'olive' },
    VI: { years: '2016–2019', motif: 'book', palette: 'green' },
    VII: { years: '2022–2026', motif: 'tape', palette: 'plum' },
    VIII: { years: '1979', motif: 'boat', palette: 'ink' },
    IX: { years: '2027', motif: 'key', palette: 'night' },
  };

  const KENAL = {
    'VIII-01': ['Kasan', 'Sisir hitam', 'Sri Mulya'], 'VIII-02': ['Ngadimin', 'Siul camar', 'Sri Mulya'], 'VIII-03': ['Suroto', 'Hitungan kayuh', 'Sri Mulya'],
    'VIII-04': ['Tarmuji', 'Joko di pundak', 'Mina Rahayu'], 'VIII-05': ['Jumadi', 'Kacang rebus', 'Mina Rahayu'], 'VIII-06': ['Slamet Riyadi', 'Puisi bungkus rokok', 'Lintang Segara'],
    'VIII-07': ['Gunadi', 'Perahu kayu waru', 'Lintang Segara'], 'VIII-08': ['Rusdi', 'Kentrung fals', 'Lintang Segara'], 'VIII-09': ['Kasiman', 'Layangan koran', 'Dewi Ratih'],
    'VIII-10': ['Ahmad Sholeh', 'Azan subuh', 'Dewi Ratih'], 'VIII-11': ['Joyo', 'Dongeng 1937', 'Dewi Ratih'], 'VIII-12': ['Marto', 'Timbang tangan', 'Sumber Rejeki'],
    'VIII-13': ['Wakidi', 'Telinga kiri', 'Sumber Rejeki'], 'VIII-14': ['Tukimin', 'Dua piring', 'Kembang Arum'], 'VIII-15': ['Wardi', 'Pisang goreng', 'Kembang Arum'],
    'VIII-16': ['Giyanto', 'Duduk di haluan', 'Jaka Tirta'], 'VIII-17': ['Kliwon', 'Rumpun pandan', 'Slamet'], 'VIII-18': ['Ridwan', 'Koran bekas', 'Wijaya Kusuma'],
    'VIII-19': ['Tasrip', 'Bambang · Endah', 'Wijaya Kusuma'],
  };

  const HINTS = [
    'Start dari 41 nama di I-02. Nggak semuanya masih mendayung.',
    'Di III-01, Mbah Rukmini nyatet siapa yang “noleh nang darat”. Tapi noleh ≠ pergi. Cross-check sama daftar Agustus 1984.',
    'Pembawa kabar = anak umur 3–6 yang kenal. Hitung tanggal lahir di I-06 terhadap 8 Februari 1979. Cucu, adik, keponakan juga count.',
    'Sembilan belas itu bukan final answer. Baca VIII-20, lalu balik ke Berkas IV pelan-pelan.',
    'Yang wafat di ranjangnya, dimandikan, dikubur, sudah tahu. Yang terseret ke laut nggak pernah lihat pemakamannya sendiri.',
    'Ejaan wajar dan nama panggilan diterima. Tapi ada empat “Jo” di arsip ini.',
  ];

  const BEKAL = [
    ['lampu', 'Baca dengan lampu nyala.', 'No ghosts involved. Banyak dokumen tulisan tangan; matamu bakal berterima kasih.'],
    ['kertas', 'Siapkan kertas: nama, umur, tanggal lahir anak-anak.', 'Warta minta ini di 0-02. Nggak ada kertas? Pakai Board di Desk.'],
    ['dongeng', 'Read it like a fairytale.', 'Penyusun arsip serius soal ini. Alasannya ada di tengah arsip.'],
    ['air', 'Kalau nyium bau garam, stop. Minum air.', 'Lalu ulangi dalam hati: ini cuma cerita.'],
  ];

  const TUGAS = [
    ['0-02', 'Baca cara membaca arsip'],
    ['I-02', 'Collect 41 nama dari laporan syahbandar'],
    ['I-06', 'Catat tanggal lahir anak-anak'],
    ['III-01', 'Siapa yang noleh, siapa yang masih datang'],
    ['V-01', 'Temukan origin story pantang kabar'],
    ['VI-02', 'Pahami lima hukum Gita'],
    ['VIII-19', 'Kenali mereka sebagai orang hidup'],
    ['VIII-20', 'Recount.'],
    ['@sent', 'Kirim kabar'],
  ];

  LE.cases = LE.cases || {};
  LE.cases.nyewu = {
    id: 'nyewu', no: '01', title: 'Nyewu',
    tagline: 'Arsip kabar duka yang belum sampai',
    hook: 'Ayah saya meninggal empat puluh tujuh tahun lalu. Dia belum tahu.',
    author: 'Disusun oleh Suwarta, Desa Pakabaran, Nusa Sewu',
    windu: new Date(2027, 1, 11),
    skin, TAPE, BERKAS, KENAL, HINTS, BEKAL, TUGAS,
  };
})(window.LE);

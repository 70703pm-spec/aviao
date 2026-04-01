export const COASTLINE_POLYLINES = [
  [
    [72, -168], [68, -154], [62, -146], [58, -138], [54, -132], [49, -128],
    [44, -126], [37, -123], [33, -118], [30, -112], [26, -105], [22, -98],
    [19, -92], [18, -86], [22, -82], [27, -79], [34, -77], [40, -72],
    [46, -66], [52, -62], [58, -68], [61, -76], [64, -92], [66, -108],
    [69, -126], [72, -150], [72, -168]
  ],
  [
    [13, -82], [8, -78], [4, -76], [-4, -78], [-12, -76], [-20, -72],
    [-28, -68], [-36, -64], [-43, -62], [-52, -66], [-55, -72], [-50, -76],
    [-43, -74], [-35, -71], [-26, -66], [-15, -62], [-5, -58], [3, -54],
    [8, -57], [11, -64], [13, -72], [13, -82]
  ],
  [
    [71, -10], [70, 8], [66, 24], [62, 34], [58, 40], [54, 44], [50, 48],
    [46, 36], [44, 26], [41, 18], [38, 10], [38, 2], [42, -6], [46, -8],
    [50, -4], [54, 4], [58, 12], [62, 20], [66, 16], [69, 4], [71, -10]
  ],
  [
    [36, -18], [32, -10], [28, 0], [24, 10], [18, 20], [10, 28], [3, 33],
    [-4, 37], [-12, 40], [-19, 34], [-26, 28], [-33, 22], [-34, 12],
    [-31, 6], [-25, 2], [-18, -2], [-10, -4], [0, -8], [10, -12],
    [20, -16], [28, -17], [36, -18]
  ],
  [
    [72, 38], [68, 52], [62, 66], [56, 82], [50, 98], [44, 112], [38, 124],
    [34, 136], [28, 146], [20, 152], [12, 146], [8, 134], [10, 120],
    [16, 108], [24, 98], [30, 90], [38, 80], [44, 70], [52, 60],
    [60, 50], [66, 42], [72, 38]
  ],
  [
    [22, 112], [18, 120], [14, 128], [8, 136], [2, 144], [-8, 150],
    [-16, 146], [-22, 138], [-30, 132], [-38, 122], [-42, 114],
    [-40, 108], [-32, 110], [-24, 116], [-16, 124], [-8, 130], [0, 134],
    [8, 132], [14, 126], [20, 118], [22, 112]
  ],
  [
    [35, 36], [34, 44], [32, 50], [30, 54], [28, 58], [26, 62], [22, 60],
    [18, 56], [16, 50], [18, 44], [22, 40], [27, 38], [32, 36], [35, 36]
  ],
  [
    [-10, 113], [-16, 114], [-22, 116], [-28, 114], [-32, 112], [-34, 106],
    [-32, 102], [-28, 100], [-24, 102], [-18, 106], [-14, 110], [-10, 113]
  ],
  [
    [80, -42], [79, -30], [77, -20], [74, -10], [72, -2], [70, -12], [70, -30],
    [72, -42], [76, -48], [80, -42]
  ],
  [
    [-64, -68], [-64, -52], [-66, -36], [-69, -20], [-72, -6], [-74, 10],
    [-76, 24], [-78, 38], [-80, 52], [-82, 68], [-80, 84], [-76, 100],
    [-72, 114], [-68, 128], [-66, 146], [-68, 164], [-72, 174], [-76, -170],
    [-72, -152], [-68, -130], [-66, -108], [-64, -88], [-64, -68]
  ]
];

export const REGION_PRESETS = {
  global: { id: 'global', label: 'Global', centerLat: 18, centerLon: 0, zoom: 0.95, tilt: 15 },
  'north-america': {
    id: 'north-america',
    label: 'North America',
    centerLat: 41,
    centerLon: -98,
    zoom: 1.55,
    tilt: 24
  },
  'south-america': {
    id: 'south-america',
    label: 'South America',
    centerLat: -18,
    centerLon: -60,
    zoom: 1.7,
    tilt: 26
  },
  europe: { id: 'europe', label: 'Europe', centerLat: 49, centerLon: 16, zoom: 1.95, tilt: 28 },
  africa: { id: 'africa', label: 'Africa', centerLat: 6, centerLon: 18, zoom: 1.65, tilt: 24 },
  'middle-east': {
    id: 'middle-east',
    label: 'Middle East',
    centerLat: 27,
    centerLon: 47,
    zoom: 2,
    tilt: 28
  },
  'asia-pacific': {
    id: 'asia-pacific',
    label: 'Asia Pacific',
    centerLat: 18,
    centerLon: 112,
    zoom: 1.48,
    tilt: 26
  }
};

export const CONTINENT_REFERENCE_LABELS = [
  { name: 'NORTH AMERICA', lat: 46, lon: -104, importance: 3 },
  { name: 'SOUTH AMERICA', lat: -19, lon: -60, importance: 2 },
  { name: 'EUROPE', lat: 54, lon: 15, importance: 2 },
  { name: 'AFRICA', lat: 5, lon: 20, importance: 2 },
  { name: 'MIDDLE EAST', lat: 28, lon: 46, importance: 1 },
  { name: 'ASIA', lat: 34, lon: 92, importance: 3 },
  { name: 'AUSTRALIA', lat: -24, lon: 134, importance: 2 }
];

export const COUNTRY_DIVISION_POLYLINES = [
  {
    id: 'canada-us-west',
    importance: 3,
    points: [[49, -124], [49, -118], [49, -112], [49, -106], [49, -100], [49, -95]]
  },
  {
    id: 'canada-us-east',
    importance: 3,
    points: [[49, -95], [48, -90], [46, -84], [45, -79], [45, -74], [46, -70], [45, -67]]
  },
  {
    id: 'us-mexico',
    importance: 3,
    points: [[32, -117], [31, -112], [31, -108], [29, -106], [28, -103], [26, -99], [26, -97]]
  },
  {
    id: 'chile-argentina',
    importance: 3,
    points: [[-18, -69], [-24, -69], [-30, -70], [-36, -71], [-42, -71], [-48, -72], [-52, -72]]
  },
  {
    id: 'brazil-argentina-paraguay',
    importance: 2,
    points: [[-22, -58], [-24, -57], [-27, -55], [-30, -56], [-33, -58], [-35, -58]]
  },
  {
    id: 'peru-brazil-bolivia',
    importance: 1,
    points: [[-7, -73], [-10, -70], [-13, -67], [-16, -65], [-19, -63], [-21, -61]]
  },
  {
    id: 'spain-france',
    importance: 2,
    points: [[43, -2], [43, 0], [43, 2], [43, 3]]
  },
  {
    id: 'france-germany',
    importance: 2,
    points: [[49, 7], [49, 8], [48, 8], [47, 7]]
  },
  {
    id: 'germany-poland',
    importance: 2,
    points: [[54, 14], [52, 14], [51, 15], [50, 16], [49, 18]]
  },
  {
    id: 'italy-alps',
    importance: 1,
    points: [[46, 7], [46, 10], [46, 12], [46, 14]]
  },
  {
    id: 'norway-sweden',
    importance: 1,
    points: [[69, 20], [66, 18], [63, 15], [60, 13], [58, 12]]
  },
  {
    id: 'ukraine-russia',
    importance: 1,
    points: [[50, 36], [49, 38], [48, 39], [47, 39], [46, 38]]
  },
  {
    id: 'morocco-algeria',
    importance: 1,
    points: [[35, -2], [34, -1], [33, 0], [32, -1]]
  },
  {
    id: 'algeria-libya',
    importance: 1,
    points: [[31, 11], [30, 15], [30, 19], [29, 23], [29, 25]]
  },
  {
    id: 'egypt-sudan',
    importance: 2,
    points: [[22, 25], [22, 29], [22, 33], [22, 35]]
  },
  {
    id: 'ethiopia-kenya',
    importance: 1,
    points: [[5, 39], [3, 39], [1, 38], [-1, 38], [-3, 39]]
  },
  {
    id: 'saudi-jordan-iraq',
    importance: 2,
    points: [[32, 39], [31, 41], [30, 43], [29, 45], [29, 47]]
  },
  {
    id: 'iran-iraq',
    importance: 2,
    points: [[37, 44], [35, 46], [33, 47], [31, 48], [29, 48]]
  },
  {
    id: 'pakistan-india',
    importance: 3,
    points: [[35, 74], [33, 74], [31, 73], [29, 71], [26, 70], [24, 68]]
  },
  {
    id: 'india-china-himalaya',
    importance: 2,
    points: [[35, 78], [33, 80], [31, 83], [29, 87], [28, 90], [28, 94], [27, 96]]
  },
  {
    id: 'china-mongolia',
    importance: 2,
    points: [[49, 87], [47, 96], [46, 104], [46, 111], [47, 118]]
  },
  {
    id: 'china-russia-east',
    importance: 1,
    points: [[53, 124], [51, 128], [49, 131], [47, 134]]
  },
  {
    id: 'korean-peninsula',
    importance: 1,
    points: [[38, 126], [37, 127], [36, 128], [35, 129]]
  },
  {
    id: 'vietnam-china',
    importance: 1,
    points: [[23, 102], [22, 104], [21, 105], [19, 106], [17, 107]]
  },
  {
    id: 'thailand-myanmar',
    importance: 1,
    points: [[20, 98], [18, 98], [16, 98], [14, 98], [12, 99]]
  },
  {
    id: 'indonesia-archipelago',
    importance: 1,
    points: [[4, 96], [1, 102], [-2, 108], [-4, 114], [-4, 120]]
  },
  {
    id: 'australia-west-east',
    importance: 1,
    points: [[-26, 129], [-30, 129], [-34, 129], [-38, 129]]
  }
];

export const COUNTRY_REFERENCE_LABELS = [
  { name: 'CANADA', lat: 57, lon: -106, importance: 2 },
  { name: 'UNITED STATES', lat: 39, lon: -98, importance: 4 },
  { name: 'MEXICO', lat: 23, lon: -102, importance: 2 },
  { name: 'CUBA', lat: 21.8, lon: -79.5, importance: 1 },
  { name: 'COLOMBIA', lat: 4.5, lon: -74, importance: 1 },
  { name: 'PERU', lat: -9.3, lon: -75.1, importance: 1 },
  { name: 'CHILE', lat: -30, lon: -71, importance: 1 },
  { name: 'BRAZIL', lat: -11, lon: -53, importance: 4 },
  { name: 'ARGENTINA', lat: -36, lon: -64, importance: 2 },
  { name: 'GREENLAND', lat: 72, lon: -41, importance: 1 },
  { name: 'UNITED KINGDOM', lat: 54, lon: -2, importance: 2 },
  { name: 'IRELAND', lat: 53.4, lon: -8.1, importance: 1 },
  { name: 'FRANCE', lat: 46, lon: 2, importance: 2 },
  { name: 'SPAIN', lat: 40, lon: -3, importance: 2 },
  { name: 'PORTUGAL', lat: 39.7, lon: -8, importance: 1 },
  { name: 'GERMANY', lat: 51, lon: 10, importance: 2 },
  { name: 'ITALY', lat: 42.5, lon: 12.5, importance: 1 },
  { name: 'NORWAY', lat: 63, lon: 11, importance: 1 },
  { name: 'SWEDEN', lat: 61, lon: 15, importance: 1 },
  { name: 'POLAND', lat: 52, lon: 19, importance: 1 },
  { name: 'UKRAINE', lat: 49, lon: 31, importance: 1 },
  { name: 'MOROCCO', lat: 31.8, lon: -7.1, importance: 1 },
  { name: 'ALGERIA', lat: 28, lon: 2.5, importance: 1 },
  { name: 'NIGERIA', lat: 9, lon: 8, importance: 2 },
  { name: 'EGYPT', lat: 27, lon: 30, importance: 2 },
  { name: 'ETHIOPIA', lat: 9.1, lon: 40.5, importance: 1 },
  { name: 'KENYA', lat: 0.1, lon: 37.9, importance: 1 },
  { name: 'SOUTH AFRICA', lat: -30, lon: 24, importance: 2 },
  { name: 'RUSSIA', lat: 60, lon: 92, importance: 4 },
  { name: 'TURKEY', lat: 39, lon: 35, importance: 2 },
  { name: 'SAUDI ARABIA', lat: 24, lon: 45, importance: 2 },
  { name: 'IRAN', lat: 32, lon: 54, importance: 1 },
  { name: 'KAZAKHSTAN', lat: 48, lon: 67, importance: 1 },
  { name: 'INDIA', lat: 22, lon: 79, importance: 4 },
  { name: 'PAKISTAN', lat: 30.4, lon: 69.3, importance: 1 },
  { name: 'CHINA', lat: 35, lon: 103, importance: 4 },
  { name: 'MONGOLIA', lat: 46.8, lon: 103.8, importance: 1 },
  { name: 'JAPAN', lat: 37, lon: 139, importance: 2 },
  { name: 'SOUTH KOREA', lat: 36.2, lon: 127.8, importance: 1 },
  { name: 'THAILAND', lat: 15.8, lon: 101, importance: 1 },
  { name: 'VIETNAM', lat: 16.7, lon: 106.3, importance: 1 },
  { name: 'INDONESIA', lat: -2, lon: 118, importance: 2 },
  { name: 'PHILIPPINES', lat: 12.5, lon: 122.8, importance: 1 },
  { name: 'AUSTRALIA', lat: -25, lon: 134, importance: 3 },
  { name: 'NEW ZEALAND', lat: -41, lon: 174, importance: 1 }
];

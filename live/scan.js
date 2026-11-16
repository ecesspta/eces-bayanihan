(function (root) {
  'use strict';

  // Document reader for the treasurer's scan-and-check flow.
  //
  // PROTOTYPE: this file is a practice reader. It returns fictional readings so the
  // review-and-submit flow can be rehearsed. It does not read handwriting.
  // A pilot replaces read() with a school-approved reading service (see ROADMAP.md).
  // Every reading must keep this shape, and a reading never posts by itself:
  // the treasurer checks each line, then the chairperson reviews the original.
  //
  // reading = {
  //   engine, direction: 'in' | 'out', date: 'YYYY-MM-DD', receipt, purpose,
  //   items: [{ description, cents, check? }],   check = why a line needs a closer look
  //   writtenTotal: cents written on the paper, or null
  //   matchesImage: false when the values did not come from the chosen photo
  // }
  const samples = {
    collection: {
      label: 'Sample collection sheet',
      filename: 'sample-collection-sheet.png',
      prefix: 'DEMO-COL',
      heading: 'SPTA Collection Sheet',
      direction: 'in',
      purpose: 'Voluntary SPTA contributions',
      items: [
        ['Grade 1 · Sampaguita', 85000],
        ['Grade 2 · Rosal', 120000],
        ['Grade 3 · Camia', 95000],
        ['Grade 4 · Dahlia', 110000],
        ['Grade 5 · Ilang-Ilang', 70000, 'The handwriting is unclear here. Check this amount.'],
        ['Grade 6 · Adelfa', 130000]
      ]
    },
    receipt: {
      label: 'Sample expense receipt',
      filename: 'sample-expense-receipt.png',
      prefix: 'DEMO-OR',
      heading: 'Official Receipt · Sample School Supplies',
      direction: 'out',
      purpose: 'Reading corner materials',
      items: [
        ['Storybooks, 12 pieces', 240000],
        ['Low bookshelf', 150000],
        ['Floor mats, 3 pieces', 60000, 'The amount is faint on the paper. Check this amount.']
      ]
    }
  };
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const known = new WeakMap();
  const peso = cents => '₱' + (cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2
  });
  function freeReference(prefix, used = []) {
    const taken = new Set(used.map(x => String(x).toLowerCase()));
    for (let n = 1; n < 1000; n++) {
      const ref = prefix + '-' + String(n).padStart(3, '0');
      if (!taken.has(ref.toLowerCase())) return ref;
    }
    return prefix + '-' + Date.now();
  }
  function practiceReading(key, options = {}) {
    const s = samples[key];
    if (!s) throw Error('Choose an available sample.');
    const items = s.items.map(([description, cents, check]) => check ? {
      description,
      cents,
      check
    } : {
      description,
      cents
    });
    return {
      engine: 'practice',
      sample: key,
      heading: s.heading,
      direction: s.direction,
      date: options.today || new Date().toISOString().slice(0, 10),
      receipt: freeReference(s.prefix, options.usedReferences),
      purpose: s.purpose,
      items,
      writtenTotal: items.reduce((sum, x) => sum + x.cents, 0),
      matchesImage: true
    };
  }

  // Draws the fictional paper so the photo on screen matches the values that are filled in.
  function drawSheet(canvas, reading) {
    const w = canvas.width = 900,
      h = canvas.height = 1180,
      c = canvas.getContext('2d');
    const hand = '"Segoe Print","Bradley Hand","Marker Felt","Comic Sans MS",cursive';
    c.fillStyle = '#fbf8ef';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#cfdcec';
    c.lineWidth = 2;
    for (let y = 300; y < h - 60; y += 72) {
      c.beginPath();
      c.moveTo(50, y);
      c.lineTo(w - 50, y);
      c.stroke();
    }
    c.strokeStyle = '#e7b5b5';
    c.beginPath();
    c.moveTo(610, 230);
    c.lineTo(610, h - 60);
    c.stroke();
    c.fillStyle = '#102b59';
    c.font = '700 36px Georgia,serif';
    c.fillText(reading.heading, 50, 86);
    c.font = '24px Georgia,serif';
    c.fillStyle = '#3d5273';
    c.fillText('East Central Elementary School · Fictional practice copy', 50, 126);
    c.fillStyle = '#1b2f6b';
    c.font = '30px ' + hand;
    c.fillText('Ref: ' + reading.receipt, 50, 190);
    c.fillText('Date: ' + reading.date, 520, 190);
    c.fillText('For: ' + reading.purpose, 50, 244);
    let y = 350;
    reading.items.forEach(x => {
      c.font = '32px ' + hand;
      c.fillText(x.description, 60, y);
      c.fillText((x.cents / 100).toLocaleString('en-PH', {
        minimumFractionDigits: 2
      }), 640, y);
      y += 72;
    });
    y += 30;
    c.font = '700 34px ' + hand;
    c.fillText('TOTAL', 60, y);
    c.fillText(peso(reading.writtenTotal), 620, y);
    c.strokeStyle = '#1b2f6b';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(610, y + 14);
    c.lineTo(w - 60, y + 14);
    c.stroke();
    c.font = '22px Georgia,serif';
    c.fillStyle = '#7b8798';
    c.fillText('No family or pupil details. For rehearsal only.', 50, h - 28);
  }
  async function sampleFile(key, options = {}) {
    const reading = practiceReading(key, options);
    const canvas = root.document.createElement('canvas');
    drawSheet(canvas, reading);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('This browser could not prepare the sample sheet.')), 'image/png'));
    const file = new File([blob], samples[key].filename, {
      type: 'image/png'
    });
    known.set(file, reading);
    return file;
  }
  async function read(file, options = {}) {
    if (!file || !file.size) throw Error('Choose a photo or PDF of the sheet.');
    if (!allowed.includes(file.type)) throw Error('Choose a JPG, PNG, WEBP or PDF.');
    if (file.size > 8 * 1024 * 1024) throw Error('Each file must be 8 MB or smaller.');
    await new Promise(resolve => setTimeout(resolve, options.delay ?? 1700));
    if (known.has(file)) return structuredClone(known.get(file));
    // The practice reader cannot read a real photo. It says so through matchesImage.
    return {
      ...practiceReading('collection', options),
      matchesImage: false
    };
  }
  const api = {
    engine: 'practice',
    samples,
    allowed,
    freeReference,
    practiceReading,
    sampleFile,
    read
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ECESScan = api;
})(globalThis);

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.sqlite');

db.serialize(() => {
  db.run("DELETE FROM tariffs");
  db.run("DELETE FROM tariff_slabs");

  db.run("INSERT INTO tariffs (id, name, type, fixed_charge, meter_rent, fuel_surcharge, electricity_duty_percent, green_tariff_optional) VALUES (1, 'KSEB LT-I Domestic', 'domestic', 50, 6, 0.10, 5, 0.77)", function(err) {
    if (err) console.error("Tariff err:", err);
    else console.log("Tariff inserted");
  });

  const telescopicSlabs = [
    { min: 0, max: 50, rate: 3.35 },
    { min: 51, max: 100, rate: 4.25 },
    { min: 101, max: 150, rate: 5.35 },
    { min: 151, max: 200, rate: 7.20 },
    { min: 201, max: 250, rate: 8.50 }
  ];
  for (const slab of telescopicSlabs) {
    db.run("INSERT INTO tariff_slabs (tariff_id, is_telescopic, min_units, max_units, rate) VALUES (1, 1, ?, ?, ?)", [slab.min, slab.max, slab.rate], (err) => { if(err) console.error(err) });
  }

  const nonTelescopicSlabs = [
    { min: 251, max: 300, rate: 6.75 },
    { min: 301, max: 350, rate: 7.60 },
    { min: 351, max: 400, rate: 7.95 },
    { min: 401, max: 500, rate: 8.25 },
    { min: 501, max: 999999, rate: 9.20 }
  ];
  for (const slab of nonTelescopicSlabs) {
    db.run("INSERT INTO tariff_slabs (tariff_id, is_telescopic, min_units, max_units, rate) VALUES (1, 0, ?, ?, ?)", [slab.min, slab.max, slab.rate], (err) => { if(err) console.error(err) });
  }
});

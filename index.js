var http = require("http");
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var md5 = require('md5');
var mysql = require('mysql');

var app = express();

app.use(cookieParser());
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/assets'));

var db = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'absenonline'
});

db.connect(function(err) {
  if (err){
    console.log('Cek your DB Connection');
    console.log(err);
  }else{
    console.log('You are now connected with mysql database...');
  }
})

//------------REGISTER-------------//
app.get('/auth/register', function(request, response) {
  response.render('auth/register');
});

app.post('/auth/registeruser', function(request, response) {
  var user = request.body.username;
  var password = request.body.password;
  var pass = md5(password);
  var nama = request.body.nama;
  var role = request.body.role;

  let sql = "SELECT * FROM user where nomorinduk ='"+user+"'";
  let query = db.query(sql, (err, results, fields) => {
    if (results.length > 0) {        
      request.session.flashdata = "NRP/NIP sudah digunakan";
      response.redirect('/auth');
    }else{
      let sql = "INSERT INTO `user`(`nomorinduk`,`nama_user`,`password`,`role`) values ('"+user+"','"+nama+"','"+pass+"','"+role+"')";
      db.query(sql, function (err, result) {
        if(err){
          console.log(err);
        }
      });
      request.session.flashdata = "Akun "+nama+" berhasil dibuat";
      response.redirect('/auth');
    }
  });
});
//-------------------END REGISTER--------------------//

//------------LOGIN--------------//
app.get('/auth', function(request, response) { 
    if(request.session.flashdata){
      var flash = request.session.flashdata;
    }
    response.render('auth/login.html',{flash});
});

app.post('/auth/login', function(request, response) {
    var user = request.body.username;
    var password = request.body.password;
    var pass = md5(password);
      let sql = "SELECT * FROM user where nomorinduk ='"+user+"' AND password='"+pass+"' limit 1";
      let query = db.query(sql, (err, results, fields) => {
        if(err){
          console.log(err);
        }
          if (results.length > 0) {   
              request.session.id_user = results[0].id_user;
              request.session.nomorinduk = results[0].nomorinduk;
              request.session.nama_user = results[0].nama_user;
              request.session.role = results[0].role;
  
              if(request.session.role == 0){
                response.redirect('/dosen');
              }else{
                  response.redirect('/mahasiswa');
                }
              }else{
              request.session.flashdata = "Username atau password salah!";
              response.redirect('/auth');
            }
          });
});

app.get('/auth/logout', function(request, response) {
    request.session.destroy();    
    response.redirect('/auth');
});
//------------END LOGIN--------------//

//----------API------------//
/*
1. Absen
    POST /absen/
    Body: ruang, nrp
*/
app.post('/absen/:ruang/:nrp', function(request, response) {
  var namaruang = request.params.ruang;
  var nomorinduk = request.params.nrp;
  var status = "2";
  var date = new Date();

  db.query('SELECT d.nomorinduk, c.namaruang,c.id_transaksi FROM daftar_peserta a, matkul b, transaksi_matkul c, user d WHERE b.id_matkul = a.id_matkul AND d.id_user=a.id_user AND c.id_matkul = b.id_matkul AND d.nomorinduk=? AND c.namaruang=?',
   [nomorinduk,namaruang], function (error, results, fields) {
    if (error){
      console.log(error);
    }
    if (results.length == 0 ){
      response.status(404).json({ error: 'Mahasiswa tidak terdaftar' });
    }else{
      var idtransaksi = results[0].id_transaksi;
      db.query('INSERT INTO transaksi_user (id_user,id_transaksi,waktu,status) values (?,?,?,?)',
       [nomorinduk,idtransaksi,date,status], function (error, results, fields) {
          if (error){
            console.log(error);
          }else{
            res.status(200).json({ OK: 'Absensi Berhasil!' });
          }
        });
    }
  });
});

/*
2. Rekap kuliah per semester
    GET /rekappersemester/IDMATAKULIAH
*/
app.get('/rekappersemester/:id_matkul', function (req, res) {
  var idmatkul = req.params.id_matkul;

  db.query('SELECT a.id_matkul,a.pertemuan_ke, b.nama_matkul, b.kelas, a.waktu_mulai, a.waktu_selesai, a.namaruang FROM transaksi_matkul a, matkul b WHERE a.id_matkul = b.id_matkul AND b.id_matkul=? ORDER BY a.pertemuan_ke',
   [idmatkul], function (error, results, fields) {
    if (error){
      console.log(error);
    }else{
      res.status(200).json(results);
    }
  });
});

/*
3. Rekap kuliah per pertemuan
    GET /rekappertemuan/IDMATAKULIAH/PERTEMUANKE
*/
app.get('/rekappertemuan/:id_matkul/:pertemuanke', function (req, res) {
  var idmatkul = req.params.id_matkul;
  var pertemuanke = req.params.pertemuanke;

  db.query('SELECT a.pertemuan_ke, b.nama_matkul, b.kelas, a.waktu_awal, a.waktu_akhir, a.ruangan FROM transaksi_matkul a, matkul b WHERE a.id_matkul = b.id_matkul AND b.id_matkul=? AND a.pertemuan_ke=? ORDER BY a.pertemuan_ke',
   [idmatkul,pertemuanke], function (error, results, fields) {
    if (error){
      console.log(error);
    }else{
      res.status(200).json(results);
    }
  });
});

/*
4. Rekap per mahasiswa per kuliah
    GET /rekapmahasiswa/NRP/IDMATAKULIAH
*/
app.get('/rekapmahasiswa/:nrp/:id_matkul', function (req, res) {
  var nomorinduk = req.params.nrp;
  var idmatkul = req.params.id_matkul;

  db.query('SELECT * FROM user a, transaksi_user b, transaksi_matkul c, matkul d WHERE a.id_user = b.id_user AND b.id_transaksi = c.id_transaksi AND c.id_matkul = d.id_matkul AND a.nomorinduk=? AND d.id_matkul=?',
   [nomorinduk,idmatkul], function (error, results, fields) {
    if (error){
      console.log(error);
    }else{
      res.status(200).json(results);
    }
  });
});
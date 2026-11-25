-- link_accounts.sql : hubungkan akun yang dibuat lewat dashboard Supabase ke store / peran.
-- Jalankan di SQL Editor SETELAH semua akun dibuat (Authentication > Users). Aman dijalankan berulang.

-- 1) Akun store: email a01@domain -> store A01, c83@domain -> store C83, dst.
insert into profiles (id, role, store_id, full_name)
select u.id, 'store', s.id, coalesce(s.pic_name || ' (' || s.short_name || ')', s.short_name)
from auth.users u
join stores s on lower(s.code) = split_part(u.email, '@', 1)
where not exists (select 1 from profiles p where p.id = u.id);

-- 2) Admin: ganti email di bawah dengan email akun admin yang kamu buat
insert into profiles (id, role, full_name)
select u.id, 'admin', 'Admin Area 19'
from auth.users u
where u.email = 'admin@area19.hokben.id'
  and not exists (select 1 from profiles p where p.id = u.id);

-- 3) (Opsional) Area manager: ganti email, hapus tanda -- di depan baris berikut
-- insert into profiles (id, role, full_name)
-- select u.id, 'area_manager', 'Area Manager 19' from auth.users u
-- where u.email = 'manager@area19.hokben.id' and not exists (select 1 from profiles p where p.id = u.id);

-- Cek hasil: harus tampil 13 baris store + 1 admin
select p.role, s.code, u.email
from profiles p join auth.users u on u.id = p.id left join stores s on s.id = p.store_id
order by p.role, s.code;

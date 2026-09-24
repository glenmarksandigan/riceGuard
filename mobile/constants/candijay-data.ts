// Candijay, Bohol — Address Data for Registration Dropdowns

export const MUNICIPALITY = 'Candijay';
export const PROVINCE = 'Bohol';
export const COUNTRY = 'Philippines';

export const BARANGAYS = [
    'Abihilan',
    'Anoling',
    'Boyo-an',
    'Cadapdapan',
    'Cambane',
    'Can-olin',
    'Canawa',
    'Cogtong',
    'La Union',
    'Luan',
    'Lungsoda-an',
    'Mahangin',
    'Pagahat',
    'Panadtaran',
    'Panas',
    'Poblacion',
    'San Isidro',
    'Tambongan',
    'Tawid',
    'Tubod (Tres Rosas)',
    'Tugas',
] as const;

export type Barangay = typeof BARANGAYS[number];

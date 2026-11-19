import { contact, schedule } from "../../shared/contact";

export const site = {
  name: "Clínica DarSpa",
  origin: "https://darspa.cl",
  phone: contact.receptionPhone,
  whatsapp: contact.receptionWhatsapp,
  doctorPhone: contact.doctorPhone,
  doctorWhatsapp: contact.doctorWhatsapp,
  receptionHours: contact.receptionHours,
  emails: [contact.doctorEmail, contact.clinicEmail],
  address: "E. Sotomayor 576, Castro",
  schedule,
  instagram: "https://www.instagram.com/darspa.cl/",
  facebook: "https://www.facebook.com/darspa.cl",
  booking:
    "https://www.doctoralia.cl/daniel-moretti-castillo/medico-general/castro?utm_source=widget-null&utm_medium=link",
  mission:
    "Deseamos ofrecer a nuestros usuarios una experiencia de servicios de alta calidad orientada a mejorar su calidad de vida, ya sea normalizando su peso corporal, disminuyendo su ansiedad, contribuyendo en su alimentación o mejorando su entrenamiento deportivo, todo lo anterior con las tecnologías más avanzadas y probadamente efectivas.",
  about:
    "Somos un conjunto de profesionales, técnicos y administrativos dedicados a dar respuesta integral a algunos de los problemas emergentes más importantes del tiempo moderno, la falta de alimentación más saludable, el incremento de obesidad, la pérdida de la autoestima y el deporte como estilo de vida.",
  difference:
    "En DarSpa creemos en los detalles, en cada pequeña acción, desde el aroma que sientes al entrar hasta el calor de la chimenea. Una sonrisa amable y atención de calidad humana, no solo técnica, y si se necesita la mirada de algún otro integrante ten por seguro que te atenderá tan bien como el anterior. Nosotros disfrutamos nuestro trabajo y nos encanta lo que hacemos. ¡Te invitamos a ser parte de la experiencia DarSpa, notarás la diferencia!",
};

export const navigation = [
  { to: "/", label: "Inicio" },
  { to: "/noticias", label: "Noticias" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/servicios", label: "Servicios" },
  { to: "/examenes", label: "Exámenes" },
  { to: "/tienda", label: "Tienda" },
] as const;

export const specialties = [
  ["Peso Corporal", "estudio metabólico, ajuste y control de peso corporal"],
  ["Ansiedad", "ansiedad alimentaria, trastornos de la alimentación"],
  ["Modelado Corporal", "Corrección localizada, cicatrices no estéticas, flacidez"],
  ["Fitness", "entrenamiento deportivo avanzado, metabolismo basal"],
  ["Wellness", "estilos de vida saludable, asesoria dietética avanzada"],
] as const;

export const serviceCategories = [
  { id: "modeladoCorporal", name: "Modelado Corporal" },
  { id: "tratamientoFacial", name: "Tratamientos Faciales" },
  { id: "masaje", name: "Masajes" },
  { id: "otros", name: "Otros Servicios" },
];

export const consultations = [
  {
    name: "Consulta de kinesiología",
    price: "$20.000 por sesión, de pago particular",
    note: "La kinesiología de rehabilitación también acepta bono Fonasa y bono Isapre Colmena.",
  },
  {
    name: "Consulta de nutrición",
    price: "$25.000 por sesión, solo de pago particular",
    note: null,
  },
];

import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import ContactClient from "@/app/components/ContactClient";

export default async function ContactPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  // Extraemos los intereses aquí para pasarlos limpios
  const interests = [
    dict.contact.interested.interest_1,
    dict.contact.interested.interest_2,
    dict.contact.interested.interest_3,
    dict.contact.interested.interest_4,
  ];

  return (
    <>
      <Navbar dict={dict} isDark={true} />
      {/* Pasamos todo el diccionario o solo lo necesario al cliente */}
      <ContactClient dict={dict} interests={interests} />
    </>
  );
}

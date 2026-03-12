import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function TermsScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#ddeeff", "#eaf4ff", "#f5f9ff"]}
        style={styles.background}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={22} color="#4a90e2" />
          </TouchableOpacity>
          <Text style={styles.title}>Termeni și Condiții</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.warningBox}>
            <View style={styles.warningTitleRow}>
              <Ionicons name="warning-outline" size={18} color="#b64a3a" style={{ marginRight: 6 }} />
              <Text style={styles.warningTitle}>ATENȚIE!</Text>
            </View>
            <Text style={styles.warningText}>
              <Text style={styles.bold}>Declinare de responsabilitate:</Text>{" "}
              Informațiile din aplicația „Dan fost Anxios" NU sunt destinate să
              înlocuiască sfatul medical profesionist, tratamentul de urgență
              sau tratamentul formal de prim ajutor. Nu utilizați aceste
              informații pentru a diagnostica sau dezvolta un plan de tratament
              pentru o problemă de sănătate sau boală fără consultarea unui
              furnizor de servicii medicale calificat.{"\n\n"}
              <Text style={styles.bold}>
                Dacă vă aflați într-o situație medicală care pune viața în
                pericol sau de urgență, solicitați imediat asistență medicală.
              </Text>
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Aplicația „Dan fost Anxios" reprezintă o platformă de dezvoltare
              personală, motivațională, de tip self-help (auto-ajutorare). Sub
              nicio formă, această aplicație nu înlocuiește un tratament
              medicamentos și/sau terapie psihiatrică și/sau psihologică.{"\n\n"}
              Sub nicio formă, această aplicație nu înlocuiește sfaturile
              persoanelor de specialitate (medici psihiatri, psihologi, etc.),
              de aceea, înainte de a pune în aplicare ideile conținute de această
              aplicație, autorul solicită să cereți părerea avizată a unui
              specialist în domeniu.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>1. DEFINIȚII ȘI TERMENI</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>O.DAN VALERIU PFA</Text> – persoană
            juridică de naționalitate română, având sediul social în Dumbravița,
            str. Gării, nr. 1251, având număr de ordine în Registrul Comerțului
            F8/641/28.04.2023, cod unic de înregistrare fiscală RO48073287.
            {"\n\n"}
            <Text style={styles.bold}>Vânzător:</Text> O DAN VALERIU PFA, cod
            unic de înregistrare fiscală RO48073287.{"\n\n"}
            <Text style={styles.bold}>Utilizator:</Text> orice persoană fizică
            care are vârsta peste 18 ani sau persoană juridică înregistrată în
            aplicație, care, prin finalizarea procesului de creare a Contului,
            și-a dat acordul cu privire la clauzele specifice din secțiunea
            Termeni și Condiții.{"\n\n"}
            <Text style={styles.bold}>Cont:</Text> secțiunea din aplicație
            formată dintr-o adresă de e-mail și o parolă care permite
            Utilizatorului accesul la conținut și servicii.{"\n\n"}
            <Text style={styles.bold}>Conținut:</Text> toate informațiile din
            aplicație care pot fi vizualizate sau accesate, inclusiv
            audio-urile, video-urile, textele și materialele educaționale.
          </Text>

          <Text style={styles.sectionTitle}>2. CONDIȚII DE UTILIZARE</Text>
          <Text style={styles.paragraph}>
            2.1. Accesul la aplicație este permis doar utilizatorilor care au
            împlinit 18 ani.{"\n\n"}
            2.2. Prin crearea unui cont și utilizarea aplicației, Utilizatorul
            acceptă în mod expres prezentele Termene și Condiții.{"\n\n"}
            2.3. Vânzătorul își rezervă dreptul de a restricționa accesul
            Utilizatorului în cazul în care activitatea acestuia ar putea
            prejudicia în vreun fel serviciile oferite.
          </Text>

          <Text style={styles.sectionTitle}>3. ABONAMENTE ȘI PLĂȚI</Text>
          <Text style={styles.paragraph}>
            3.1. Aplicația oferă diferite tipuri de abonamente (Trial, Basic,
            Premium, VIP) cu funcționalități și prețuri diferite.{"\n\n"}
            3.2. Prețurile sunt exprimate în lei (RON) și includ T.V.A. conform
            legislației în vigoare.{"\n\n"}
            3.3. Plățile se procesează prin intermediul procesatorului de plăți
            Stripe. Datele cardului nu sunt stocate de aplicație.{"\n\n"}
            3.4. Abonamentele se reînnoiesc automat la sfârșitul perioadei
            contractate, cu excepția cazului în care sunt anulate de utilizator.
          </Text>

          <Text style={styles.sectionTitle}>4. DREPTUL DE RETRAGERE</Text>
          <Text style={styles.paragraph}>
            4.1. Conform OUG nr. 34/2014, aveți dreptul de a vă retrage din
            contract în termen de 14 zile calendaristice, fără invocarea
            niciunui motiv.{"\n\n"}
            4.2. Pentru serviciile digitale, dreptul de retragere nu se aplică
            dacă prestarea a început cu acordul dvs. prealabil expres și după ce
            ați confirmat că ați luat cunoștință de faptul că vă veți pierde
            dreptul la retragere.{"\n\n"}
            4.3. Pentru exercitarea dreptului de retragere, contactați-ne la:
            danolteanu02@gmail.com
          </Text>

          <Text style={styles.sectionTitle}>
            5. PROPRIETATE INTELECTUALĂ
          </Text>
          <Text style={styles.paragraph}>
            5.1. Tot conținutul aplicației (logo-uri, texte, imagini, audio-uri,
            video-uri) este proprietatea exclusivă a O.DAN VALERIU PFA.{"\n\n"}
            5.2. Utilizatorului nu îi este permisă copierea, distribuirea,
            publicarea sau modificarea conținutului fără acordul scris al
            proprietarului.{"\n\n"}
            5.3. Conținutul poate fi utilizat doar în scopuri personale,
            non-comerciale.
          </Text>

          <Text style={styles.sectionTitle}>6. CONFIDENȚIALITATE</Text>
          <Text style={styles.paragraph}>
            6.1. Vânzătorul va păstra confidențialitatea informațiilor
            furnizate.{"\n\n"}
            6.2. Datele cu caracter personal sunt prelucrate în conformitate cu
            Regulamentul (UE) 2016/679 (GDPR).{"\n\n"}
            6.3. Pentru mai multe informații, consultați Politica de
            Confidențialitate disponibilă în aplicație.
          </Text>

          <Text style={styles.sectionTitle}>7. PROTECȚIA DATELOR (GDPR)</Text>
          <Text style={styles.paragraph}>
            7.1. Colectăm și prelucrăm date personale pentru:{"\n"}
            • Prestarea serviciilor în beneficiul dvs.{"\n"}
            • Îmbunătățirea serviciilor noastre{"\n"}
            • Comunicări comerciale (cu consimțământul dvs.){"\n\n"}
            7.2. Aveți dreptul de a:{"\n"}
            • Accesa datele dvs. personale{"\n"}
            • Solicita rectificarea sau ștergerea datelor{"\n"}
            • Vă opune prelucrării{"\n"}
            • Portabilitatea datelor{"\n\n"}
            7.3. Contact pentru protecția datelor: danolteanu02@gmail.com
          </Text>

          <Text style={styles.sectionTitle}>8. RĂSPUNDERE</Text>
          <Text style={styles.paragraph}>
            8.1. Vânzătorul nu poate fi responsabil pentru daune rezultate din
            utilizarea informațiilor din aplicație.{"\n\n"}
            8.2. Utilizatorul își asumă responsabilitatea pentru menținerea
            confidențialității datelor de cont.{"\n\n"}
            8.3. Autorul nu face nicio declarație sau garanție cu privire la
            acuratețea, aplicabilitatea sau completitudinea conținutului.
          </Text>

          <Text style={styles.sectionTitle}>9. FORȚĂ MAJORĂ</Text>
          <Text style={styles.paragraph}>
            Niciuna din părți nu va fi răspunzătoare pentru neexecutarea
            obligațiilor contractuale dacă aceasta este datorată unui eveniment
            de forță majoră (eveniment imprevizibil, în afara controlului
            părților).
          </Text>

          <Text style={styles.sectionTitle}>10. LEGEA APLICABILĂ</Text>
          <Text style={styles.paragraph}>
            10.1. Prezentul document este supus legii române.{"\n\n"}
            10.2. Pentru sesizări sau reclamații: danolteanu02@gmail.com sau
            telefon 0743713788.{"\n\n"}
            10.3. Termenul maxim de soluționare a reclamațiilor este de 30 de
            zile calendaristice.{"\n\n"}
            10.4. Pentru soluționarea alternativă a litigiilor (SAL/SOL), puteți
            contacta:{"\n"}
            • ANPC: Bulevardul Aviatorilor nr. 72, sector 1, București{"\n"}
            • E-mail: dsal@anpc.ro{"\n"}
            • Platforma europeană SOL: ec.europa.eu/consumers/odr
          </Text>

          <View style={styles.contactBox}>
            <View style={styles.contactTitleRow}>
              <Ionicons name="call-outline" size={16} color="#1a2d45" style={{ marginRight: 6 }} />
              <Text style={styles.contactTitle}>Contact</Text>
            </View>
            <Text style={styles.contactText}>
              O.DAN VALERIU PFA{"\n"}
              Dumbravița, str. Gării, nr. 1251{"\n"}
              CUI: RO48073287{"\n"}
              E-mail: danolteanu02@gmail.com{"\n"}
              Telefon: 0743713788
            </Text>
          </View>

          <Text style={styles.lastUpdated}>
            Ultima actualizare: Noiembrie 2025
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ddeeff' },
  background: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,220,240,0.5)",
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(74,144,226,0.15)",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 20, fontWeight: "700",
    color: "#1a2d45",
    textAlign: "center",
    marginRight: 38,
  },
  content: { padding: 20 },
  warningBox: {
    backgroundColor: "#fff4f2", borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#f5d0ca",
  },
  warningTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  warningTitle: { fontSize: 16, fontWeight: "700", color: "#b64a3a" },
  warningText: { fontSize: 14, color: "#8b3a2e", lineHeight: 22 },
  infoBox: {
    backgroundColor: "#eaf3ff", borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.8)",
  },
  infoText: { fontSize: 14, color: "#2c5282", lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a2d45", marginTop: 20, marginBottom: 12 },
  paragraph: { fontSize: 14, color: "#4a5568", lineHeight: 22, textAlign: "justify" },
  bold: { fontWeight: "700", color: "#1a2d45" },
  contactBox: {
    backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 18, padding: 16, marginTop: 24,
    borderWidth: 1, borderColor: "rgba(200,220,240,0.6)",
    shadowColor: "#4a90e2", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  contactTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  contactTitle: { fontSize: 16, fontWeight: "700", color: "#1a2d45" },
  contactText: { fontSize: 14, color: "#4a5568", lineHeight: 22 },
  lastUpdated: { fontSize: 12, color: "#8ca8c4", textAlign: "center", marginTop: 24, fontStyle: "italic" },
});

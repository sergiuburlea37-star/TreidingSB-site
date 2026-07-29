-- 202607290001_portfolios_metadata_seed.sql
--
-- Seed pentru METADATELE celor 2 portofolii (US, EU) - public.portfolios.
-- Valorile de mai jos sunt extrase EXACT din index.html (branch main, live
-- azi pe treidingsb.com), nu sunt inventate. Vezi raportul insotitor pentru
-- sursa exacta a fiecarei valori si pentru inconsistentele gasite.
--
-- NU se aplica automat - nu e in supabase/migrations/, ca sa nu fie preluat
-- de `supabase db push` ca migrare de schema. Rulare manuala, o singura
-- data, DOAR dupa aprobare separata.
--
-- Idempotent: `on conflict (code) do nothing` - rularea repetata nu creeaza
-- duplicate si nu suprascrie eventuale editari facute ulterior din Admin.
-- Identificator stabil: coloana `code` (deja UNIQUE in schema), nu id-ul
-- generat automat.
--
-- IMPORTANT - ce NU contine acest fisier, si de ce:
-- Acest fisier populeaza DOAR public.portfolios. NU insereaza nicio pozitie
-- in public.portfolio_positions. Motiv: schema tabelei portfolio_positions
-- cere `quantity` si `avg_price` (ambele NOT NULL, adica numar de actiuni +
-- pret de achizitie per actiune). Sursa reala (index.html) nu contine
-- niciodata aceste 2 valori - contine doar ponderi procentuale (%) si,
-- pentru portofoliul US, o suma alocata in lire per pozitie (nu pret x
-- cantitate). Completarea cu 0 sau cu valori inventate ar prezenta date
-- lipsa ca fiind reale si ar strica orice calcul de performanta ulterior -
-- exact ce a fost interzis explicit. Pozitiile raman de completat separat,
-- dupa ce lipsurile sunt clarificate - vezi raportul insotitor, sectiunea
-- "Etapa 4, punctul 19".
--
-- `published` e setat `false` in mod deliberat: capitalul declarat pe
-- pagina publica (10.000 GBP / 10.000 EUR) nu se potriveste cu suma
-- pozitiilor afisate (vezi raportul - discrepante gasite la ambele
-- portofolii), iar pozitiile nici nu exista inca in baza. Nu are sens sa
-- publicam un portofoliu incomplet/cu cifre neclarificate. Schimba manual
-- in `true` dupa ce confirmi cifrele si adaugi pozitiile.

insert into public.portfolios
  (code, name, base_currency, initial_capital, target_return_text, risk_level, description, published)
  values
    (
        'US',
            'Portofoliu US',
                'GBP',
                    10000,
                        '~7-10%/an (tinta declarata pe pagina publica, nu randament realizat)',
                            'moderat',
                                'Portofoliu diversificat demonstrativ, risc moderat, orizont 3-5 ani.',
                                    false
                                      ),
                                        (
                                            'EU',
                                                'Portofoliu European Moderat+',
                                                    'EUR',
                                                        10000,
                                                            null,
                                                                'moderat',
                                                                    'Strategie pe 3-5 ani, intrare in transe, control al riscului.',
                                                                        false
                                                                          )
                                                                          on conflict (code) do nothing;

                                                                          -- Nota: `founded_date` este intentionat NEcompletat (ramane NULL). Textul
                                                                          -- "Fondat 17.06.2026" apare pe pagina la ambele portofolii, dar e parte
                                                                          -- dintr-o propozitie de marketing, nu un camp structurat - necesita
                                                                          -- confirmarea ta explicita inainte sa fie tratat ca data reala de start
                                                                          -- (vezi raportul, Etapa 2, punctul 7).
                                                                          

"""
Clinical Drug Registry & Pharmacological Taxonomy (<=195 LOC)
Nguồn: CSDL Dược Quốc gia DAV, QĐ 5948/QĐ-BYT, QĐ 3445/QĐ-BYT
"""

DRUG_REGISTRY: dict[str, dict] = {
    "clopidogrel": {
        "display": "Clopidogrel", "aliases": ["plavix", "clopidogrel", "pidogrel", "clopidrel"],
        "classes": ["P2Y12_INHIBITOR"], "cyp_sub": ["CYP2C19"], "risk": ["bleeding"]
    },
    "omeprazol": {
        "display": "Omeprazol", "aliases": ["omeprazol", "omeprazole", "losec", "lomac", "omez"],
        "classes": ["PPI_CYP2C19"], "cyp_inh": ["CYP2C19"], "risk": []
    },
    "esomeprazol": {
        "display": "Esomeprazol", "aliases": ["esomeprazol", "esomeprazole", "nexium", "esocare", "inopraz"],
        "classes": ["PPI_CYP2C19"], "cyp_inh": ["CYP2C19"], "risk": []
    },
    "pantoprazol": {
        "display": "Pantoprazol", "aliases": ["pantoprazol", "pantoprazole", "pantoloc", "pantosec"],
        "classes": ["PPI_SAFE"], "risk": []
    },
    "nitroglycerin": {
        "display": "Nitroglycerin", "aliases": ["nitroglycerin", "nitromint", "nitroglycerine", "nitro"],
        "classes": ["NITRATE"], "risk": []
    },
    "isosorbid": {
        "display": "Isosorbid dinitrat/mononitrat", "aliases": ["isosorbid", "imdur", "isoket"],
        "classes": ["NITRATE"], "risk": []
    },
    "sildenafil": {
        "display": "Sildenafil", "aliases": ["sildenafil", "viagra", "kamagra", "siloflam"],
        "classes": ["PDE5_INHIBITOR"], "risk": []
    },
    "tadalafil": {
        "display": "Tadalafil", "aliases": ["tadalafil", "cialis"],
        "classes": ["PDE5_INHIBITOR"], "risk": []
    },
    "simvastatin": {
        "display": "Simvastatin", "aliases": ["simvastatin", "zocor"],
        "classes": ["STATIN_CYP3A4"], "cyp_sub": ["CYP3A4"], "risk": []
    },
    "atorvastatin": {
        "display": "Atorvastatin", "aliases": ["atorvastatin", "lipitor", "atormax"],
        "classes": ["STATIN_CYP3A4"], "cyp_sub": ["CYP3A4"], "risk": []
    },
    "clarithromycin": {
        "display": "Clarithromycin", "aliases": ["clarithromycin", "klacid", "klaricid"],
        "classes": ["MACROLIDE_CYP3A4"], "cyp_inh": ["CYP3A4"], "risk": ["qt_prolonging"]
    },
    "erythromycin": {
        "display": "Erythromycin", "aliases": ["erythromycin"],
        "classes": ["MACROLIDE_CYP3A4"], "cyp_inh": ["CYP3A4"], "risk": ["qt_prolonging"]
    },
    "itraconazol": {
        "display": "Itraconazol", "aliases": ["itraconazol", "sporanox"],
        "classes": ["AZOLE_CYP"], "cyp_inh": ["CYP3A4"], "risk": []
    },
    "ketorolac": {
        "display": "Ketorolac", "aliases": ["ketorolac", "toradol"],
        "classes": ["NSAID"], "risk": ["bleeding", "nephrotoxic"]
    },
    "aceclofenac": {
        "display": "Aceclofenac", "aliases": ["aceclofenac", "presocan"],
        "classes": ["NSAID"], "risk": ["bleeding", "nephrotoxic"]
    },
    "diclofenac": {
        "display": "Diclofenac", "aliases": ["diclofenac", "voltaren"],
        "classes": ["NSAID"], "risk": ["bleeding", "nephrotoxic"]
    },
    "ibuprofen": {
        "display": "Ibuprofen", "aliases": ["ibuprofen", "advil", "motrin", "alaxan"],
        "classes": ["NSAID"], "risk": ["bleeding", "nephrotoxic"]
    },
    "ceftriaxon": {
        "display": "Ceftriaxon", "aliases": ["ceftriaxon", "ceftriaxone", "rocephin"],
        "classes": ["CEFTRIAXONE"], "risk": []
    },
    "calci": {
        "display": "Calci / Ringer Lactat / Hartmann", "aliases": ["calci", "canxi", "ringer lactat", "calcium", "hartmann"],
        "classes": ["CALCIUM_CARRIER"], "risk": []
    },
    "amiodaron": {
        "display": "Amiodaron", "aliases": ["amiodaron", "amiodarone", "cordarone"],
        "classes": ["ANTIARRHYTHMIC_III"], "p_gp_inh": True, "risk": ["qt_prolonging"]
    },
    "colchicin": {
        "display": "Colchicin", "aliases": ["colchicin", "colchicine", "colchimax"],
        "classes": ["COLCHICINE"], "p_gp_sub": True, "risk": []
    },
    "digoxin": {
        "display": "Digoxin", "aliases": ["digoxin", "lanoxin"],
        "classes": ["DIGITALIS"], "p_gp_sub": True, "risk": []
    },
    "ciprofloxacin": {
        "display": "Ciprofloxacin", "aliases": ["ciprofloxacin", "cifran", "ciprobay"],
        "classes": ["FLUOROQUINOLONE"], "cyp_inh": ["CYP1A2"], "risk": ["qt_prolonging"]
    },
    "levofloxacin": {
        "display": "Levofloxacin", "aliases": ["levofloxacin", "cravit", "tavanic"],
        "classes": ["FLUOROQUINOLONE"], "risk": ["qt_prolonging"]
    },
    "moxifloxacin": {
        "display": "Moxifloxacin", "aliases": ["moxifloxacin", "avelox"],
        "classes": ["FLUOROQUINOLONE"], "risk": ["qt_prolonging"]
    },
    "theophyllin": {
        "display": "Theophyllin", "aliases": ["theophyllin", "theophylline", "theostat"],
        "classes": ["THEOPHYLLINE"], "cyp_sub": ["CYP1A2"], "risk": []
    },
    "tramadol": {
        "display": "Tramadol", "aliases": ["tramadol", "tramal", "ultram"],
        "classes": ["OPIOID", "SEROTONERGIC"], "risk": ["cns_depressant"]
    },
    "linezolid": {
        "display": "Linezolid", "aliases": ["linezolid", "zyvox"],
        "classes": ["MAOI"], "risk": []
    },
    "morphin": {
        "display": "Morphin", "aliases": ["morphin", "morphine"],
        "classes": ["OPIOID"], "risk": ["cns_depressant"]
    },
    "fentanyl": {
        "display": "Fentanyl", "aliases": ["fentanyl", "durogesic"],
        "classes": ["OPIOID"], "risk": ["cns_depressant"]
    },
    "diazepam": {
        "display": "Diazepam", "aliases": ["diazepam", "seduxen", "valium"],
        "classes": ["BENZODIAZEPINE"], "risk": ["cns_depressant"]
    },
    "midazolam": {
        "display": "Midazolam", "aliases": ["midazolam", "dormicum"],
        "classes": ["BENZODIAZEPINE"], "risk": ["cns_depressant"]
    },
    "paracetamol": {
        "display": "Paracetamol", "aliases": ["paracetamol", "panadol", "efferalgan", "acetaminophen", "hapacol"],
        "classes": ["ANALGESIC_ANTIPYRETIC"], "risk": []
    },
    "spironolacton": {
        "display": "Spironolacton", "aliases": ["spironolacton", "spironolactone", "aldactone", "verospiron"],
        "classes": ["POTASSIUM_SPARING"], "risk": ["hyperkalemia"]
    },
    "enalapril": {
        "display": "Enalapril", "aliases": ["enalapril", "renitec", "ednyt"],
        "classes": ["RAAS_INHIBITOR", "ACEI"], "risk": ["hyperkalemia"]
    },
    "losartan": {
        "display": "Losartan", "aliases": ["losartan", "cozaar"],
        "classes": ["RAAS_INHIBITOR", "ARB"], "risk": ["hyperkalemia"]
    },
    "furosemid": {
        "display": "Furosemid", "aliases": ["furosemid", "furosemide", "lasix"],
        "classes": ["LOOP_DIURETIC"], "risk": ["nephrotoxic"]
    },
    "metformin": {
        "display": "Metformin", "aliases": ["metformin", "glucophage", "panfor"],
        "classes": ["BIGUANIDE"], "risk": []
    },
    "thuoc_can_quang": {
        "display": "Thuốc cản quang chứa iod", "aliases": ["thuoc can quang", "can quang", "xenetix", "omnipaque", "ultravist", "iodinated contrast"],
        "classes": ["IODINATED_CONTRAST"], "risk": ["nephrotoxic"]
    },
    "methotrexat": {
        "display": "Methotrexat", "aliases": ["methotrexat", "methotrexate"],
        "classes": ["ANTIMETABOLITE"], "risk": ["nephrotoxic"]
    },
    "antacid": {
        "display": "Antacid (Nhôm, Magnesi, Sắt, Canxi)", "aliases": ["antacid", "nhom", "magnesi", "sat", "gastropulgite", "maalox", "phosphalugel"],
        "classes": ["MULTIVALENT_CATION"], "risk": []
    }
}

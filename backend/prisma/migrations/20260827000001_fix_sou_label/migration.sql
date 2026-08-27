-- Correction : SOU = Souris (présence de souris), pas Souillé
UPDATE "ControlStatus"
SET label = 'Souris', description = 'Présence de souris détectée'
WHERE code = 'SOU';

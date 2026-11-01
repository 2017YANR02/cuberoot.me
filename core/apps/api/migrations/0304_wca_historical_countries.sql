-- Keep historical participation/solve totals in separate representation buckets.
-- Existing totals remain readable until the next stats-extra rebuild replaces them.
ALTER TABLE wca_fs_person_comps DROP CONSTRAINT wca_fs_person_comps_pkey;
ALTER TABLE wca_fs_person_comps ADD PRIMARY KEY (wca_id, country_id);
ALTER TABLE wca_fs_person_solves DROP CONSTRAINT wca_fs_person_solves_pkey;
ALTER TABLE wca_fs_person_solves ADD PRIMARY KEY (wca_id, country_id);
ALTER TABLE wca_fs_person_year_solves DROP CONSTRAINT wca_fs_person_year_solves_pkey;
ALTER TABLE wca_fs_person_year_solves ADD PRIMARY KEY (wca_id, country_id, year);

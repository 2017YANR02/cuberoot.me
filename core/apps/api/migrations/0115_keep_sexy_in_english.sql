-- Keep the cubing term "sexy" in English in all first-party content.
UPDATE wiki_terms
SET head = 'Sexy Move',
    head_zh = 'Sexy Move'
WHERE head_en = 'Sexy Move'
  AND (head LIKE '%' || U&'\6027\611F' || '%'
       OR head_zh LIKE '%' || U&'\6027\611F' || '%');

UPDATE alg_cases
SET algs = replace(
             replace(
               replace(
                 replace(
                   replace(
                     algs::text,
                     U&'\6027\611F\8F6C\52A8\63A5 Sledge\FF0C\4F7F\7528\5BBD\5C42\8F6C\52A8',
                     'Sexy sledge with wide moves'
                   ),
                   U&'\6027\611F\8F6C\52A8\63A5 Sledge',
                   'Sexy sledge'
                 ),
                 U&'\53CD\6027\611F\8F6C\52A8',
                 'inverse sexy'
               ),
               U&'\53CC\6027\611F\8F6C\52A8',
               'double sexy'
             ),
             U&'\6027\611F\8F6C\52A8',
             'sexy'
           )::jsonb
WHERE algs::text LIKE '%' || U&'\6027\611F' || '%';

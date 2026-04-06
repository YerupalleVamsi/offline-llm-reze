import re

def extract_strings(file_path):
    with open(file_path, 'rb') as f:
        data = f.read()

    # Find all strings that look like typical morph targets via regex in the binary file
    # We look for printable ascii strings length >= 1
    strings = set(re.findall(b'[a-zA-Z0-9_]{2,30}', data))
    
    # Filter strings that might be morph targets
    keywords = [
        b'viseme', b'mouth', b'lip', b'jaw', b'smile', b'frown', b'blink', b'eye',
        b'A', b'I', b'U', b'E', b'O', b'Joy', b'Angry', b'Sorrow', b'Fun', b'Neutral'
    ]
    
    possible_targets = set()
    for s in strings:
        for k in keywords:
            if k.lower() in s.lower() or s in [b'A', b'I', b'U', b'E', b'O']:
                possible_targets.add(s.decode('ascii', errors='ignore'))
                break
                
    print("Possible Morph Targets:")
    for t in sorted(list(possible_targets)):
        print(t)

extract_strings(r'd:\pjt\3d-avatar\reze__stylized_anime_girl.glb')

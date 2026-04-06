import struct
import json

def read_gltf(glb_path):
    with open(glb_path, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF': return "Not glb"
        struct.unpack('<II', f.read(8))
        chunk_len, chunk_type = struct.unpack('<II', f.read(8))
        json_data = f.read(chunk_len).decode('utf-8')
        gltf = json.loads(json_data)
        
        # Look for targetNames
        names = []
        for mesh in gltf.get('meshes', []):
            if 'extras' in mesh and 'targetNames' in mesh['extras']:
                names.extend(mesh['extras']['targetNames'])
            elif 'primitives' in mesh:
                for prim in mesh['primitives']:
                    if 'extras' in prim and 'targetNames' in prim['extras']:
                        names.extend(prim['extras']['targetNames'])
        
        print("TARGET NAMES:", names)
        
        if not names:
            # Let's inspect the first mesh with targets
            for i, mesh in enumerate(gltf.get('meshes', [])):
                if 'primitives' in mesh:
                    for p_i, prim in enumerate(mesh['primitives']):
                        if 'targets' in prim:
                            print(f"Mesh {i} Prim {p_i} has {len(prim['targets'])} targets but no targetNames in extras")
                            if 'extras' in mesh:
                                print(f"  mesh extras: {mesh['extras']}")
                            if 'extras' in prim:
                                print(f"  prim extras: {prim['extras']}")
                            
        # Try to find VRM extension data
        if 'extensions' in gltf and 'VRM' in gltf['extensions']:
            blendshape = gltf['extensions']['VRM'].get('blendShapeMaster', {}).get('blendShapeGroups', [])
            print("VRM BlendShapes:", [b.get('name') for b in blendshape])
            
        # Try to find VRMC_vrm extension data
        if 'extensions' in gltf and 'VRMC_vrm' in gltf['extensions']:
            custom_expressions = gltf['extensions']['VRMC_vrm'].get('expressions', {})
            print("VRMC Expressions:", list(custom_expressions.keys()))

read_gltf(r'd:\pjt\3d-avatar\reze__stylized_anime_girl.glb')

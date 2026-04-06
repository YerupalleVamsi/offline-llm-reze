import json
import struct

def get_glb_json(file_path):
    with open(file_path, 'rb') as f:
        data = f.read()

    start = data.find(b'{')
    if start == -1: 
        print("No JSON found")
        return
    
    json_len = struct.unpack('<I', data[12:16])[0]
    json_bytes = data[start:start+json_len]
    
    try:
        gltf = json.loads(json_bytes.decode('utf-8', errors='ignore'))
        
        found = False
        for i, mesh in enumerate(gltf.get('meshes', [])):
            if 'extras' in mesh and 'targetNames' in mesh.get('extras', {}):
                print(f"Mesh {i} targetNames:", mesh['extras']['targetNames'])
                found = True
            for j, prim in enumerate(mesh.get('primitives', [])):
                if 'extras' in prim and 'targetNames' in prim.get('extras', {}):
                    print(f"Mesh {i} Primitive {j} targetNames:", prim['extras']['targetNames'])
                    found = True

        if 'extensions' in gltf and 'VRM' in gltf['extensions']:
            blendshape = gltf['extensions']['VRM'].get('blendShapeMaster', {}).get('blendShapeGroups', [])
            print("VRM BlendShapes:", [b.get('name') for b in blendshape])
            found = True
            
        if 'nodes' in gltf:
            print("GLTF Nodes (potential bones):")
            node_names = [n.get('name') for n in gltf['nodes'] if 'name' in n]
            print(node_names)

    except Exception as e:
        print("Error parsing:", e)

get_glb_json(r'd:\pjt\3d-avatar\reze__stylized_anime_girl.glb')

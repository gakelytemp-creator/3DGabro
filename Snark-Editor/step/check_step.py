"""Read a STEP file with OpenCascade and report: solids, faces, validity, volume, surface kinds."""
import sys, collections
from OCP.STEPControl import STEPControl_Reader
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID, TopAbs_FACE, TopAbs_SHELL
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_SurfaceType
from OCP.ShapeAnalysis import ShapeAnalysis_Shell

NAMES = {v: k.replace('GeomAbs_', '') for k, v in GeomAbs_SurfaceType.__members__.items()}
for path in sys.argv[1:]:
    r = STEPControl_Reader()
    if r.ReadFile(path) != 1:
        print(path, 'READ FAILED'); continue
    r.TransferRoots(); shape = r.OneShape()
    ex = TopExp_Explorer(shape, TopAbs_SOLID); k = 0
    print(path)
    while ex.More():
        s = TopoDS.Solid(ex.Current()); k += 1
        g = GProp_GProps(); BRepGProp.VolumeProperties_s(s, g)
        kinds = collections.Counter(); fe = TopExp_Explorer(s, TopAbs_FACE); nf = 0
        while fe.More():
            nf += 1; kinds[NAMES.get(BRepAdaptor_Surface(TopoDS.Face(fe.Current())).GetType(), '?')] += 1; fe.Next()
        sh = TopExp_Explorer(s, TopAbs_SHELL); free = 0
        while sh.More():
            sa = ShapeAnalysis_Shell(); sa.LoadShells(sh.Current()); free += 1 if sa.HasFreeEdges() else 0; sh.Next()
        print(f'  solid {k}: valid={BRepCheck_Analyzer(s).IsValid()} free_edges={bool(free)} faces={nf} volume={g.Mass():.6f}  {dict(kinds)}')
        ex.Next()
    if not k: print('  NO SOLIDS')

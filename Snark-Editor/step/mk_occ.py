"""STEP files written by another kernel (OpenCascade), to read back: its faces close on themselves with seam edges, cylinders come whole, etc."""
import math
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder, BRepPrimAPI_MakeSphere, BRepPrimAPI_MakeCone, BRepPrimAPI_MakeTorus
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.BRepFilletAPI import BRepFilletAPI_MakeFillet, BRepFilletAPI_MakeChamfer
from OCP.gp import gp_Ax2, gp_Pnt, gp_Dir
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_EDGE
from OCP.TopoDS import TopoDS
from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.Interface import Interface_Static
def ax(x, y, z, dx=0, dy=0, dz=1): return gp_Ax2(gp_Pnt(x, y, z), gp_Dir(dx, dy, dz))
def fillet(s, r):
    f = BRepFilletAPI_MakeFillet(s); e = TopExp_Explorer(s, TopAbs_EDGE)
    while e.More(): f.Add(r, TopoDS.Edge(e.Current())); e.Next()
    return f.Shape()
def save(name, s):
    w = STEPControl_Writer(); w.Transfer(s, STEPControl_AsIs); w.Write(name + '.step')
    g = GProp_GProps(); BRepGProp.VolumeProperties_s(s, g); print(name, 'volume %.4f' % g.Mass())
box = BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 0), 60, 40, 10).Shape()
hole = BRepPrimAPI_MakeCylinder(ax(30, 20, -1), 6, 12).Shape()
save('occ_plate_hole', BRepAlgoAPI_Cut(box, hole).Shape())
save('occ_cylinder', BRepPrimAPI_MakeCylinder(ax(0, 0, 0), 15, 40).Shape())
save('occ_sphere', BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 0), 15).Shape())
save('occ_cone', BRepPrimAPI_MakeCone(ax(0, 0, 0), 15, 5, 20).Shape())
save('occ_cone_tip', BRepPrimAPI_MakeCone(ax(0, 0, 0), 15, 0, 20).Shape())
save('occ_torus', BRepPrimAPI_MakeTorus(ax(0, 0, 0), 20, 5).Shape())
save('occ_box_fillet', fillet(BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 0), 40, 30, 20).Shape(), 3))
save('occ_cyl_fillet', fillet(BRepPrimAPI_MakeCylinder(ax(0, 0, 0), 15, 30).Shape(), 4))
bracket = BRepAlgoAPI_Fuse(BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 0), 60, 40, 8).Shape(), BRepPrimAPI_MakeCylinder(ax(30, 20, 0), 10, 25).Shape()).Shape()
bracket = BRepAlgoAPI_Cut(bracket, BRepPrimAPI_MakeCylinder(ax(30, 20, -1), 5, 30).Shape()).Shape()
bracket = BRepAlgoAPI_Cut(bracket, BRepPrimAPI_MakeCylinder(ax(10, 10, -1), 3, 12).Shape()).Shape()
bracket = BRepAlgoAPI_Cut(bracket, BRepPrimAPI_MakeCylinder(ax(30, -5, 15, 0, 1, 0), 3, 50).Shape()).Shape()     # a cross hole: cylinder through cylinder
save('occ_bracket', bracket)
save('occ_bracket_fillet', fillet(BRepAlgoAPI_Cut(BRepAlgoAPI_Fuse(BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 0), 60, 40, 8).Shape(), BRepPrimAPI_MakeCylinder(ax(30, 20, 0), 10, 25).Shape()).Shape(), BRepPrimAPI_MakeCylinder(ax(30, 20, -1), 5, 30).Shape()).Shape(), 1.5))

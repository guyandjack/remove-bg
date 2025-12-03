type PropsPatern = {
  width: number;
  height: number;
  color?: string;
  styled?: string;
};




const DesignPaternPoint = ({width, height, color, styled}: PropsPatern) => {
  return (
    <div className={`w-[${width}px] h-[${height}px] ${styled}`}>
      <div className={`patern-point-${color}`}></div>
    </div>
  );
}



export { DesignPaternPoint }
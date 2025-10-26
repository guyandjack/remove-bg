import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

function CarouselServices() {
  return (
    <Carousel
      
      opts={{
        align: "start",
        loop: true,
      }}
    >
      <CarouselContent>
        <CarouselItem className="md:basis-1/2 lg:basis-1/5">
          1..
          {/* <img
              className="block"
              src="../../../src/assets/images/eiliv-aceron-ZuIDLSz3XLg-unsplash.jpg"
              width="300"
               height="300" 
            ></img> */}
        </CarouselItem>
        <CarouselItem className="md:basis-1/2 lg:basis-1/5">
          2..
          {/* <img
            className="block"
            src="../../../src/assets/images/joseph-gonzalez-fdlZBWIP0aM-unsplash.jpg"
            width="300"
            height="300"
          ></img> */}
        </CarouselItem>
        <CarouselItem className="md:basis-1/2 lg:basis-1/5">
          3..
          {/* <img
            className="block"
            src="../../../src/assets/images/joseph-gonzalez-zcUgjyqEwe8-unsplash.jpg"
            width="300"
            height="300"
          ></img> */}
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

export { CarouselServices };
